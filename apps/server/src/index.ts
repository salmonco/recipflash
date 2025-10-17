import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOllama } from "@langchain/ollama";
import { initTRPC } from "@trpc/server";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import express from "express";
import multer from "multer";
import fetch, { Blob, FormData } from "node-fetch"; // For making HTTP requests to Python AI server
import { z } from "zod";
import { PrismaClient } from "./generated/prisma";

// Define explicit success and error response types
interface SuccessAiRecipeResponse {
  success: true;
  recipe: string;
}

interface ErrorResponse {
  success: false;
  error: string;
}

interface SuccessRecipesResponse {
  success: true;
  recipes: {
    id: number;
    title: string;
    menus: { id: number; name: string; ingredients: string }[];
  }[];
}

interface SuccessRecipeResponse {
  success: true;
  recipe: {
    id: number;
    title: string;
    menus: { id: number; name: string; ingredients: string }[];
  };
}

interface SuccessUpdateMenuResponse {
  success: true;
  menu: { id: number; name: string; ingredients: string };
}

interface SuccessUpdateRecipeTitleResponse {
  success: true;
  recipe: {
    id: number;
    title: string;
    menus: { id: number; name: string; ingredients: string }[];
  };
}

interface SuccessDeleteResponse {
  success: true;
}

// --- TRPC, LangChain, Prisma, Multer Setup ---
const t = initTRPC.create();
const prisma = new PrismaClient();
const storage = multer.memoryStorage(); // Store file in memory
const upload = multer({ storage: storage });

// --- tRPC Router Definition ---
const appRouter = t.router({
  greeting: t.procedure
    .input(z.object({ name: z.string() }))
    .query(({ input }) => {
      return `Hello, ${input.name}!`;
    }),

  getAiRecipe: t.procedure
    .input(z.object({ topic: z.string() }))
    .query(
      async ({ input }): Promise<SuccessAiRecipeResponse | ErrorResponse> => {
        try {
          const llm = new ChatOllama({
            model: "llama3",
            baseUrl: "http://localhost:11434",
          });
          const prompt = ChatPromptTemplate.fromMessages([
            ["system", "You are an expert chef."],
            ["human", "Give a simple and short recipe idea about {topic}."],
          ]);
          const outputParser = new StringOutputParser();
          const chain = prompt.pipe(llm).pipe(outputParser);
          const result = await chain.invoke({ topic: input.topic });
          return { success: true, recipe: result.trim() };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown error";
          console.error("Error calling LangChain/Ollama:", message);
          return { success: false, error: message };
        }
      }
    ),

  updateMenu: t.procedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        ingredients: z.string().optional(),
      })
    )
    .mutation(
      async ({ input }): Promise<SuccessUpdateMenuResponse | ErrorResponse> => {
        const { id, name, ingredients } = input;
        try {
          const updatedMenu = await prisma.menu.update({
            where: { id },
            data: {
              ...(name && { name }),
              ...(ingredients && { ingredients }),
            },
          });
          return { success: true, menu: updatedMenu };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown error";
          console.error("Error updating menu item:", message);
          return { success: false, error: message };
        }
      }
    ),

  getAllRecipes: t.procedure.query(
    async (): Promise<SuccessRecipesResponse | ErrorResponse> => {
      try {
        const recipes = await prisma.recipe.findMany({
          include: { menus: true }, // Include associated menus
        });
        return { success: true, recipes };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        console.error("Error fetching all recipes:", message);
        return { success: false, error: message };
      }
    }
  ),

  getRecipeById: t.procedure
    .input(z.object({ id: z.number() }))
    .query(
      async ({ input }): Promise<SuccessRecipeResponse | ErrorResponse> => {
        const { id } = input;
        try {
          const recipe = await prisma.recipe.findUnique({
            where: { id },
            include: { menus: true }, // Include associated menus
          });
          if (!recipe) {
            return { success: false, error: "Recipe not found." };
          }
          return { success: true, recipe };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown error";
          console.error("Error fetching recipe by ID:", message);
          return { success: false, error: message };
        }
      }
    ),

  updateRecipeTitle: t.procedure
    .input(
      z.object({
        id: z.number(),
        title: z.string(),
      })
    )
    .mutation(
      async ({
        input,
      }): Promise<SuccessUpdateRecipeTitleResponse | ErrorResponse> => {
        const { id, title } = input;
        try {
          const updatedRecipe = await prisma.recipe.update({
            where: { id },
            data: { title },
            include: { menus: true }, // Add this line
          });
          return { success: true, recipe: updatedRecipe };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown error";
          console.error("Error updating recipe title:", message);
          return { success: false, error: message };
        }
      }
    ),

  deleteRecipe: t.procedure
    .input(z.object({ id: z.number() }))
    .mutation(
      async ({ input }): Promise<SuccessDeleteResponse | ErrorResponse> => {
        const { id } = input;
        try {
          await prisma.recipe.delete({
            where: { id },
          });
          return { success: true };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown error";
          console.error("Error deleting recipe:", message);
          return { success: false, error: message };
        }
      }
    ),

  deleteMenu: t.procedure
    .input(z.object({ id: z.number() }))
    .mutation(
      async ({ input }): Promise<SuccessDeleteResponse | ErrorResponse> => {
        const { id } = input;
        try {
          await prisma.menu.delete({
            where: { id },
          });
          return { success: true };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown error";
          console.error("Error deleting menu item:", message);
          return { success: false, error: message };
        }
      }
    ),
});

export type AppRouter = typeof appRouter;

// --- Express App Setup ---
const app = express();

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
  })
);

// --- Start Server ---
const port = 4000;
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
