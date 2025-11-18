import z from "zod";
import { prisma } from "../../prisma";
import { protectedProcedure, router } from "../../trpc";
import { ErrorResponse, SuccessResponse } from "../../types/type";

type RecipeResponse = {
  id: number;
  title: string;
  menus: { id: number; name: string; ingredients: string[] }[];
};

type RecipesResponse = {
  recipes: RecipeResponse[];
};

export const recipeRouter = router({
  getAllRecipes: protectedProcedure.query(
    async ({
      ctx,
    }): Promise<SuccessResponse<RecipesResponse> | ErrorResponse> => {
      const userId = ctx.user.id;
      try {
        const recipes = await prisma.recipe.findMany({
          where: { userId: userId },
          include: {
            menus: {
              include: {
                ingredients: true,
              },
            },
          },
        });

        const formattedRecipes = recipes.map((recipe) => ({
          ...recipe,
          menus: recipe.menus.map((menu) => ({
            ...menu,
            ingredients: menu.ingredients
              .map((ingredient) => ingredient.name)
              .filter((name): name is string => name !== null),
          })),
        }));

        return { success: true, data: { recipes: formattedRecipes } };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        console.error("Error fetching all recipes:", message);
        return { success: false, errorCode: 500, errorMessage: message };
      }
    }
  ),

  getRecipeById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(
      async ({
        input,
        ctx,
      }): Promise<SuccessResponse<RecipeResponse> | ErrorResponse> => {
        const { id } = input;
        const userId = ctx.user.id;
        try {
          const recipe = await prisma.recipe.findFirst({
            where: { id: id, userId: userId },
            include: {
              menus: {
                include: {
                  ingredients: true,
                },
              },
            },
          });
          if (!recipe) {
            return {
              success: false,
              errorCode: 404,
              errorMessage: "Recipe not found.",
            };
          }

          const formattedRecipe = {
            ...recipe,
            menus: recipe.menus.map((menu) => ({
              ...menu,
              ingredients: menu.ingredients
                .map((ingredient) => ingredient.name)
                .filter((name): name is string => name !== null),
            })),
          };

          return { success: true, data: formattedRecipe };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown error";
          console.error("Error fetching recipe by ID:", message);
          return { success: false, errorCode: 500, errorMessage: message };
        }
      }
    ),

  createRecipe: protectedProcedure
    .input(z.object({ title: z.string() }))
    .mutation(
      async ({
        input,
        ctx,
      }): Promise<SuccessResponse<RecipeResponse> | ErrorResponse> => {
        const { title } = input;
        const userId = ctx.user.id;
        try {
          const newRecipe = await prisma.recipe.create({
            data: {
              title: title || "레시피 모음 1",
              userId: userId,
            },
            include: {
              menus: {
                include: {
                  ingredients: true,
                },
              },
            },
          });

          const formattedRecipe = {
            ...newRecipe,
            menus: newRecipe.menus.map((menu) => ({
              ...menu,
              ingredients: menu.ingredients
                .map((ingredient) => ingredient.name)
                .filter((name): name is string => name !== null),
            })),
          };

          return { success: true, data: formattedRecipe };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown error";
          console.error("Error creating recipe:", message);
          return { success: false, errorCode: 500, errorMessage: message };
        }
      }
    ),

  updateRecipeTitle: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string(),
      })
    )
    .mutation(
      async ({
        input,
        ctx,
      }): Promise<SuccessResponse<RecipeResponse> | ErrorResponse> => {
        const { id, title } = input;
        try {
          const updatedRecipe = await prisma.recipe.update({
            where: { id, userId: ctx.user.id },
            data: { title },
            include: {
              menus: {
                include: {
                  ingredients: true,
                },
              },
            },
          });

          const formattedRecipe = {
            ...updatedRecipe,
            menus: updatedRecipe.menus.map((menu) => ({
              ...menu,
              ingredients: menu.ingredients
                .map((ingredient) => ingredient.name)
                .filter((name): name is string => name !== null),
            })),
          };

          return { success: true, data: formattedRecipe };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown error";
          console.error("Error updating recipe title:", message);
          return { success: false, errorCode: 500, errorMessage: message };
        }
      }
    ),

  deleteRecipe: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(
      async ({ input, ctx }): Promise<SuccessResponse | ErrorResponse> => {
        const { id } = input;
        try {
          await prisma.recipe.delete({
            where: { id, userId: ctx.user.id },
          });
          return { success: true, data: undefined };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown error";
          console.error("Error deleting recipe:", message);
          return { success: false, errorCode: 500, errorMessage: message };
        }
      }
    ),
});
