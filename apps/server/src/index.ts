import { createExpressMiddleware } from "@trpc/server/adapters/express";
import express from "express";
import multer from "multer";
import fetch, { Blob, FormData } from "node-fetch"; // For making HTTP requests to Python AI server
import { createContext } from "./context";
import { initFirebaseAdmin } from "./initFirebaseAdmin";
import { prisma } from "./prisma";
import { authRouter } from "./router/auth";
import { menuRouter } from "./router/menu";
import { recipeRouter } from "./router/recipe";
import { testRouter } from "./router/test";
import { router } from "./trpc";

initFirebaseAdmin();

const storage = multer.memoryStorage(); // Store file in memory
const upload = multer({ storage: storage });

// --- tRPC Router Definition ---
const appRouter = router({
  test: testRouter,
  auth: authRouter,
  recipe: recipeRouter,
  menu: menuRouter,
});

export type AppRouter = typeof appRouter;

// --- Express App Setup ---
const app = express();
app.use(express.json()); // Add this line to parse JSON bodies

// --- Express Route for PDF Upload ---
app.post("/upload-recipe", upload.single("recipe"), async (req, res) => {
  if (!req.file) {
    return res.status(400).send({ error: "No file uploaded." });
  }

  try {
    // 1. Forward PDF to Python AI server for processing
    const formData = new FormData();
    formData.append(
      "file",
      new Blob([new Uint8Array(req.file.buffer)], { type: req.file.mimetype }),
      req.file.originalname
    );

    const pythonAiResponse = await fetch(
      "http://localhost:8000/generate/menus",
      {
        method: "POST",
        body: formData,
        headers: {},
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

    if (!Array.isArray(menus) || menus.some((c) => !c.name || !c.ingredients)) {
      throw new Error("AI did not return a valid menu array.");
    }

    // 2. Save to database in a transaction
    const newRecipe = await prisma.$transaction(async (tx) => {
      let recipeTitle = req.file?.originalname;

      if (!recipeTitle) {
        // Generate a default title if originalname is not available
        const recipeCount = await tx.recipe.count();
        recipeTitle = `레시피 모음 ${recipeCount + 1}`;
      } else {
        // Remove file extension for a cleaner title
        const lastDotIndex = recipeTitle.lastIndexOf(".");
        if (lastDotIndex > 0) {
          recipeTitle = recipeTitle.substring(0, lastDotIndex);
        }
      }

      const recipe = await tx.recipe.create({
        data: {
          title: recipeTitle,
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

    // 3. Return the result
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
});

// --- tRPC Middleware ---
app.use(
  "/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

// --- Start Server ---
const port = 4000;
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
