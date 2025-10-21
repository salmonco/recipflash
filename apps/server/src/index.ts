import { createExpressMiddleware } from "@trpc/server/adapters/express";
import express from "express";
import { createContext } from "./context";
import { initFirebaseAdmin } from "./initFirebaseAdmin";
import { authRouter } from "./router/auth";
import { menuRouter } from "./router/menu";
import { recipeRouter } from "./router/recipe";
import { testRouter } from "./router/test";
import { uploadRouter } from "./router/upload";
import { router } from "./trpc";

initFirebaseAdmin();

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
app.use(uploadRouter);

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
