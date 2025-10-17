import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '../../server/src/index'; // Adjust path as needed
import { Recipe } from './models/Recipe'; // Assuming this path

export const trpc = createTRPCReact<AppRouter>();

export interface SuccessRecipesResponse {
  success: true;
  recipes: Recipe[];
}

export interface SuccessRecipeResponse {
  success: true;
  recipe: Recipe;
}
