import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOllama } from "@langchain/ollama";
import z from "zod";
import { publicProcedure, router } from "../../trpc";
import { ErrorResponse, SuccessResponse } from "../../types/type";

type AiRecipeResponse = {
  recipe: string;
};

export const testRouter = router({
  getAiRecipe: publicProcedure
    .input(z.object({ topic: z.string() }))
    .query(
      async ({
        input,
      }): Promise<SuccessResponse<AiRecipeResponse> | ErrorResponse> => {
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
          return { success: true, data: { recipe: result.trim() } };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          console.error("Error calling LangChain/Ollama:", errorMessage);
          return {
            success: false,
            errorCode: 500,
            errorMessage: errorMessage,
          };
        }
      }
    ),
});
