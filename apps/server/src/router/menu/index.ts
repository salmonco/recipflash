import z from "zod";
import { prisma } from "../../prisma";
import { protectedProcedure, router } from "../../trpc";
import { ErrorResponse, SuccessResponse } from "../../types/type";

type UpdateMenuResponse = {
  id: number;
  name: string;
  ingredients: string;
};

export const menuRouter = router({
  createMenu: protectedProcedure
    .input(
      z.object({
        recipeId: z.number(),
        name: z.string(),
        ingredients: z.string(),
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
              ingredients,
              recipeId,
            },
          });
          return { success: true, data: newMenu };
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
        ingredients: z.string().optional(),
      })
    )
    .mutation(
      async ({
        input,
      }): Promise<SuccessResponse<UpdateMenuResponse> | ErrorResponse> => {
        const { id, name, ingredients } = input;
        try {
          const updatedMenu = await prisma.menu.update({
            where: { id },
            data: {
              ...(name && { name }),
              ...(ingredients && { ingredients }),
            },
          });
          return { success: true, data: updatedMenu };
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
});
