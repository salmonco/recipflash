import { createExpressMiddleware } from "@trpc/server/adapters/express";
import express from "express";
import { createContext } from "./context";
import { initFirebaseAdmin } from "./initFirebaseAdmin";
import { authRouter } from "./router/auth";
import { menuRouter } from "./router/menu";
import { recipeRouter } from "./router/recipe";
import { testRouter } from "./router/test";
import { uploadRouter } from "./router/upload";
import { streamingUploadRouter } from "./router/upload/streaming";
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
app.use(streamingUploadRouter); // 스트리밍 라우터 추가

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
