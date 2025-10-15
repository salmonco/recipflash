import express from 'express';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import { ChatOllama } from "@langchain/ollama";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

const t = initTRPC.create();

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
        // Use the non-deprecated ChatOllama class
        const llm = new ChatOllama({
          model: "llama3",
          baseUrl: "http://localhost:11434",
        });

        // Use a ChatPromptTemplate for Chat Models
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

const app = express();

app.use(
  "/trpc",
  createExpressMiddleware({
    router: appRouter,
  })
);

const port = 4000;
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
