import express from "express";
import multer from "multer";
import fetch, { Blob, FormData } from "node-fetch";
import { AuthenticatedRequest, authenticateUser } from "../../middleware/auth";
import { prisma } from "../../prisma";

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.post(
  "/upload-recipe",
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

    try {
      // S3 Upload Logic
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

      const formData = new FormData();

      formData.append(
        "file",
        new Blob([new Uint8Array(req.file.buffer)], {
          type: req.file.mimetype,
        }),
        req.file.originalname
      );

      const pythonAiResponse = await fetch(
        `${process.env.API_URL}/generate/menus`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!pythonAiResponse.ok) {
        const errorText = await pythonAiResponse.text();
        throw new Error(
          `Python AI server error: ${pythonAiResponse.status} - ${errorText}`
        );
      }

      const aiResult: any = await pythonAiResponse.json();
      const menus = aiResult.menus;

      if (
        !Array.isArray(menus) ||
        menus.some((c) => !c.name || !c.ingredients)
      ) {
        throw new Error("AI did not return a valid menu array.");
      }

      const newRecipe = await prisma.$transaction(async (tx) => {
        let recipeTitle = req.file?.originalname || `레시피 모음`;
        const lastDotIndex = recipeTitle.lastIndexOf(".");
        if (lastDotIndex > 0) {
          recipeTitle = recipeTitle.substring(0, lastDotIndex);
        }

        const recipe = await tx.recipe.create({
          data: {
            title: recipeTitle,
            userId: userId,
          },
        });

        await tx.menu.createMany({
          data: menus.map((menu) => ({
            name: menu.name,
            ingredients: menu.ingredients,
            recipeId: recipe.id,
          })),
        });

        return recipe;
      });

      const result = await prisma.recipe.findUnique({
        where: { id: newRecipe.id },
        include: { menus: true },
      });

      res.status(201).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("Error processing PDF upload:", message);
      res.status(500).send({
        error: "Failed to process PDF and generate flashcards.",
        details: message,
      });
    }
  }
);

export const uploadRouter = router;
