import express from "express";
import multer from "multer";
import fetch, { Blob, FormData } from "node-fetch";
import { AuthenticatedRequest, authenticateUser } from "../../middleware/auth";
import { prisma } from "../../prisma";

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

/**
 * 순차 스트리밍 업로드 엔드포인트
 * Server-Sent Events (SSE)를 사용하여 진행 상황을 실시간으로 전송
 * 페이지 순서대로 처리
 */
router.post(
  "/upload-recipe-stream",
  upload.single("recipe"),
  authenticateUser,
  async (req: AuthenticatedRequest, res) => {
    if (!req.file) {
      return res.status(400).send({ error: "No file uploaded." });
    }

    if (
      req.file.mimetype !== "application/pdf" &&
      !req.file.mimetype.startsWith("image/")
    ) {
      return res
        .status(400)
        .send({ error: "Only PDF and image files are allowed." });
    }

    const userId = req.userId;
    if (!userId) {
      return res.status(401).send({ error: "UNAUTHORIZED" });
    }

    // SSE 헤더 설정
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    try {
      // 1. S3 업로드
      const s3BucketUrl = process.env.AWS_S3_BUCKET_URL || "";
      const fileName = `${Date.now()}-${req.file.originalname}`;
      const s3UploadUrl = `${s3BucketUrl}/${fileName}`;

      await fetch(s3UploadUrl, {
        method: "PUT",
        body: req.file.buffer,
        headers: {
          "Content-Type": req.file.mimetype,
        },
      });

      // 2. AI 서버로 스트리밍 요청
      const formData = new FormData();
      formData.append(
        "file",
        new Blob([new Uint8Array(req.file.buffer)], {
          type: req.file.mimetype,
        }),
        req.file.originalname
      );

      const pythonAiResponse = await fetch(
        `${process.env.API_URL}/generate/menus/stream`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!pythonAiResponse.ok) {
        await pythonAiResponse.text(); // 에러 텍스트 읽기
        res.write(
          `data: ${JSON.stringify({
            type: "error",
            message: `AI server error: ${pythonAiResponse.status}`,
          })}\n\n`
        );
        res.end();
        return;
      }

      // 3. 레시피 생성 (메뉴는 나중에 추가)
      let recipeTitle = req.file?.originalname || `레시피 모음`;
      const lastDotIndex = recipeTitle.lastIndexOf(".");
      if (lastDotIndex > 0) {
        recipeTitle = recipeTitle.substring(0, lastDotIndex);
      }

      const recipe = await prisma.recipe.create({
        data: {
          title: recipeTitle,
          userId,
        },
      });

      // 레시피 ID 전송
      res.write(
        `data: ${JSON.stringify({
          type: "recipe_created",
          recipeId: recipe.id,
        })}\n\n`
      );

      // 4. 스트리밍 응답 처리
      const allMenus: any[] = [];
      let buffer = "";

      // SSE 스트림 파싱
      for await (const chunk of pythonAiResponse.body as any) {
        buffer += chunk.toString();

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6);
            try {
              const data = JSON.parse(dataStr);

              if (data.type === "init") {
                // 초기화 메시지 전달
                res.write(`data: ${JSON.stringify(data)}\n\n`);
              } else if (data.type === "progress") {
                // 페이지별 메뉴를 DB에 저장
                const menus = data.menus || [];
                const parsedMenus = menus.map((m: any) => ({
                  name: m.name.trim(),
                  ingredients:
                    typeof m.ingredients === "string"
                      ? m.ingredients
                          .split(",")
                          .map((i: string) => i.trim())
                          .filter(Boolean)
                      : [],
                }));

                // DB에 저장
                const createdMenus = await Promise.all(
                  parsedMenus.map((m: { name: string; ingredients: string[] }) =>
                    prisma.menu.create({
                      data: { name: m.name, recipeId: recipe.id },
                    })
                  )
                );

                // 재료 저장
                const allIngredients: { name: string; menuId: number }[] = [];
                createdMenus.forEach((menu, index) => {
                  parsedMenus[index].ingredients.forEach((ingredient: string) => {
                    allIngredients.push({ name: ingredient, menuId: menu.id });
                  });
                });

                if (allIngredients.length > 0) {
                  await prisma.ingredient.createMany({
                    data: allIngredients,
                    skipDuplicates: true,
                  });
                }

                allMenus.push(...menus);

                // 진행 상황 전송 (DB 저장된 메뉴 포함)
                res.write(
                  `data: ${JSON.stringify({
                    ...data,
                    recipeId: recipe.id,
                  })}\n\n`
                );
              } else if (data.type === "complete") {
                // 완료 메시지 전송
                res.write(
                  `data: ${JSON.stringify({
                    ...data,
                    recipeId: recipe.id,
                    totalMenus: allMenus.length,
                  })}\n\n`
                );
              } else if (data.type === "error") {
                // 오류 전송
                res.write(`data: ${JSON.stringify(data)}\n\n`);
              }
            } catch (e) {
              console.error("Failed to parse SSE data:", dataStr, e);
            }
          }
        }
      }

      res.end();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("Error in streaming upload:", message);

      res.write(
        `data: ${JSON.stringify({
          type: "error",
          message: "Failed to process file",
          details: message,
        })}\n\n`
      );
      res.end();
    }
  }
);

/**
 * 병렬 스트리밍 업로드 엔드포인트
 * Server-Sent Events (SSE)를 사용하여 진행 상황을 실시간으로 전송
 * 모든 페이지를 병렬 처리하고 순서대로 전송 (순서 보장)
 */
router.post(
  "/upload-recipe-stream-parallel",
  upload.single("recipe"),
  authenticateUser,
  async (req: AuthenticatedRequest, res) => {
    if (!req.file) {
      return res.status(400).send({ error: "No file uploaded." });
    }

    if (
      req.file.mimetype !== "application/pdf" &&
      !req.file.mimetype.startsWith("image/")
    ) {
      return res
        .status(400)
        .send({ error: "Only PDF and image files are allowed." });
    }

    const userId = req.userId;
    if (!userId) {
      return res.status(401).send({ error: "UNAUTHORIZED" });
    }

    // SSE 헤더 설정
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    try {
      // 1. S3 업로드
      const s3BucketUrl = process.env.AWS_S3_BUCKET_URL || "";
      const fileName = `${Date.now()}-${req.file.originalname}`;
      const s3UploadUrl = `${s3BucketUrl}/${fileName}`;

      await fetch(s3UploadUrl, {
        method: "PUT",
        body: req.file.buffer,
        headers: {
          "Content-Type": req.file.mimetype,
        },
      });

      // 2. AI 서버로 병렬 스트리밍 요청
      const formData = new FormData();
      formData.append(
        "file",
        new Blob([new Uint8Array(req.file.buffer)], {
          type: req.file.mimetype,
        }),
        req.file.originalname
      );

      const pythonAiResponse = await fetch(
        `${process.env.API_URL}/generate/menus/stream-parallel`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!pythonAiResponse.ok) {
        await pythonAiResponse.text();
        res.write(
          `data: ${JSON.stringify({
            type: "error",
            message: `AI server error: ${pythonAiResponse.status}`,
          })}\n\n`
        );
        res.end();
        return;
      }

      // 3. 레시피 생성
      let recipeTitle = req.file?.originalname || `레시피 모음`;
      const lastDotIndex = recipeTitle.lastIndexOf(".");
      if (lastDotIndex > 0) {
        recipeTitle = recipeTitle.substring(0, lastDotIndex);
      }

      const recipe = await prisma.recipe.create({
        data: {
          title: recipeTitle,
          userId,
        },
      });

      // 레시피 ID 전송
      res.write(
        `data: ${JSON.stringify({
          type: "recipe_created",
          recipeId: recipe.id,
        })}\n\n`
      );

      // 4. 스트리밍 응답 처리
      const allMenus: any[] = [];
      let buffer = "";

      // SSE 스트림 파싱
      for await (const chunk of pythonAiResponse.body as any) {
        buffer += chunk.toString();

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6);
            try {
              const data = JSON.parse(dataStr);

              if (data.type === "init") {
                // 초기화 메시지 전달
                res.write(`data: ${JSON.stringify(data)}\n\n`);
              } else if (data.type === "progress") {
                // 페이지별 메뉴를 DB에 저장
                const menus = data.menus || [];
                const parsedMenus = menus.map((m: any) => ({
                  name: m.name.trim(),
                  ingredients:
                    typeof m.ingredients === "string"
                      ? m.ingredients
                          .split(",")
                          .map((i: string) => i.trim())
                          .filter(Boolean)
                      : [],
                }));

                // DB에 저장
                const createdMenus = await Promise.all(
                  parsedMenus.map((m: { name: string; ingredients: string[] }) =>
                    prisma.menu.create({
                      data: { name: m.name, recipeId: recipe.id },
                    })
                  )
                );

                // 재료 저장
                const allIngredients: { name: string; menuId: number }[] = [];
                createdMenus.forEach((menu, index) => {
                  parsedMenus[index].ingredients.forEach((ingredient: string) => {
                    allIngredients.push({ name: ingredient, menuId: menu.id });
                  });
                });

                if (allIngredients.length > 0) {
                  await prisma.ingredient.createMany({
                    data: allIngredients,
                    skipDuplicates: true,
                  });
                }

                allMenus.push(...menus);

                // 진행 상황 전송 (DB 저장된 메뉴 포함)
                res.write(
                  `data: ${JSON.stringify({
                    ...data,
                    recipeId: recipe.id,
                  })}\n\n`
                );
              } else if (data.type === "complete") {
                // 완료 메시지 전송
                res.write(
                  `data: ${JSON.stringify({
                    ...data,
                    recipeId: recipe.id,
                    totalMenus: allMenus.length,
                  })}\n\n`
                );
              } else if (data.type === "error") {
                // 오류 전송
                res.write(`data: ${JSON.stringify(data)}\n\n`);
              }
            } catch (e) {
              console.error("Failed to parse SSE data:", dataStr, e);
            }
          }
        }
      }

      res.end();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("Error in parallel streaming upload:", message);

      res.write(
        `data: ${JSON.stringify({
          type: "error",
          message: "Failed to process file",
          details: message,
        })}\n\n`
      );
      res.end();
    }
  }
);

export const streamingUploadRouter = router;
