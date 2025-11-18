import z from "zod";
import { prisma } from "../../prisma";
import { protectedProcedure, router } from "../../trpc";
import { ErrorResponse, SuccessResponse } from "../../types/type";

type UpdateMenuResponse = {
  id: number;
  name: string;
  ingredients: string[];
};

export const menuRouter = router({
  createMenu: protectedProcedure
    .input(
      z.object({
        recipeId: z.number(),
        name: z.string(),
        ingredients: z.array(z.string()), // Changed to array of strings
      })
    )
    .mutation(
      async ({
        input,
      }): Promise<SuccessResponse<UpdateMenuResponse> | ErrorResponse> => {
        const { recipeId, name, ingredients } = input;
        try {
          const newMenu = await prisma.menu.create({
            data: {
              name,
              recipeId,
              ingredients: {
                create: ingredients.map((ingredientName) => ({
                  name: ingredientName,
                })),
              },
            },
            include: {
              ingredients: true, // Include ingredients to format the response
            },
          });

          const formattedMenu = {
            ...newMenu,
            ingredients: newMenu.ingredients.map(
              (ingredient) => ingredient.name ?? ""
            ),
          };

          return { success: true, data: formattedMenu };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown error";
          console.error("Error creating menu item:", message);
          return { success: false, errorCode: 500, errorMessage: message };
        }
      }
    ),

  updateMenu: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        ingredients: z.array(z.string()).optional(), // Changed to array of strings
      })
    )
    .mutation(
      async ({
        input,
      }): Promise<SuccessResponse<UpdateMenuResponse> | ErrorResponse> => {
        const { id, name, ingredients } = input;
        try {
          // Delete existing ingredients if new ones are provided
          if (ingredients !== undefined) {
            await prisma.ingredient.deleteMany({
              where: { menuId: id },
            });
          }

          const updatedMenu = await prisma.menu.update({
            where: { id },
            data: {
              ...(name && { name }),
              ...(ingredients !== undefined && {
                Ingredient: {
                  create: ingredients.map((ingredientName) => ({
                    name: ingredientName,
                  })),
                },
              }),
            },
            include: {
              ingredients: true, // Include ingredients to format the response
            },
          });

          const formattedMenu = {
            ...updatedMenu,
            ingredients: updatedMenu.ingredients.map(
              (ingredient) => ingredient.name ?? ""
            ),
          };

          return { success: true, data: formattedMenu };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          console.error("Error updating menu item:", errorMessage);
          return { success: false, errorCode: 500, errorMessage: errorMessage };
        }
      }
    ),

  deleteMenu: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }): Promise<SuccessResponse | ErrorResponse> => {
      const { id } = input;
      try {
        await prisma.menu.delete({
          where: { id },
        });
        return { success: true, data: undefined };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        console.error("Error deleting menu item:", message);
        return { success: false, errorCode: 500, errorMessage: message };
      }
    }),

  getMenuById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(
      async ({
        input,
      }): Promise<SuccessResponse<UpdateMenuResponse> | ErrorResponse> => {
        const { id } = input;
        try {
          const menu = await prisma.menu.findUnique({
            where: { id },
            include: {
              ingredients: true,
            },
          });
          if (!menu) {
            return {
              success: false,
              errorCode: 404,
              errorMessage: "Menu not found.",
            };
          }

          const formattedMenu = {
            ...menu,
            ingredients: menu.ingredients.map(
              (ingredient) => ingredient.name ?? ""
            ),
          };

          return { success: true, data: formattedMenu };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown error";
          console.error("Error fetching menu by ID:", message);
          return { success: false, errorCode: 500, errorMessage: message };
        }
      }
    ),

  getAllMenusByRecipeId: protectedProcedure
    .input(z.object({ recipeId: z.number() }))
    .query(
      async ({
        input,
      }): Promise<SuccessResponse<UpdateMenuResponse[]> | ErrorResponse> => {
        const { recipeId } = input;
        try {
          const menus = await prisma.menu.findMany({
            where: { recipeId },
            include: {
              ingredients: true,
            },
          });

          const formattedMenus = menus.map((menu) => ({
            ...menu,
            ingredients: menu.ingredients.map(
              (ingredient) => ingredient.name ?? ""
            ),
          }));

          return { success: true, data: formattedMenus };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown error";
          console.error("Error fetching menus by recipe ID:", message);
          return { success: false, errorCode: 500, errorMessage: message };
        }
      }
    ),
});
