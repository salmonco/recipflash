import express from 'express';
import path from 'path';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import { ChatOllama } from "@langchain/ollama";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { PrismaClient } from './generated/prisma';
import multer from 'multer';
import fetch, { FormData, Blob } from 'node-fetch'; // For making HTTP requests to Python AI server

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
    .query(async ({ input }) => {
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
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error calling LangChain/Ollama:', message);
        return { success: false, error: message };
      }
    }),
});

export type AppRouter = typeof appRouter;

// --- Express App Setup ---
const app = express();

// --- Express Route for PDF Upload ---
app.post('/upload-recipe', upload.single('recipe'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send({ error: 'No file uploaded.' });
  }

  try {
    // 1. Forward PDF to Python AI server for processing
    const formData = new FormData();
    formData.append(
        'file',
        new Blob([new Uint8Array(req.file.buffer)], { type: req.file.mimetype }),
        req.file.originalname
    );

    const pythonAiResponse = await fetch('http://localhost:8000/generate/flashcards', {
      method: 'POST',
      body: formData,
      headers: {},
    });

    if (!pythonAiResponse.ok) {
      const errorText = await pythonAiResponse.text();
      throw new Error(`Python AI server error: ${pythonAiResponse.status} - ${errorText}`);
    }

    const aiResult: any = await pythonAiResponse.json();
    const flashcards = aiResult.flashcards;

    if (!Array.isArray(flashcards) || flashcards.some(c => !c.front || !c.back)) {
        throw new Error('AI did not return a valid flashcard array.');
    }

    // 2. Save to database in a transaction
    const newRecipe = await prisma.$transaction(async (tx) => {
        const recipe = await tx.recipe.create({
            data: {
                title: req.file?.originalname || 'Untitled Recipe',
            },
        });

        await tx.flashcard.createMany({
            data: flashcards.map(card => ({
                front: card.front,
                back: card.back,
                recipeId: recipe.id,
            })),
        });

        return recipe;
    });

    // 3. Return the result
    const result = await prisma.recipe.findUnique({
        where: { id: newRecipe.id },
        include: { cards: true },
    });

    res.status(201).json(result);

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error processing PDF upload:', message);
    res.status(500).send({ error: 'Failed to process PDF and generate flashcards.', details: message });
  }
});

// --- tRPC Middleware ---
app.use(
  '/trpc',
  createExpressMiddleware({
    router: appRouter,
  })
);

// --- Start Server ---
const port = 4000;
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
