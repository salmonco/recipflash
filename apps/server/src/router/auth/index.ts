import * as admin from "firebase-admin";
import { jwtDecode } from "jwt-decode";
import { z } from "zod";
import { prisma } from "../../prisma";
import { publicProcedure, router } from "../../trpc";

export const authRouter = router({
  googleLogin: publicProcedure
    .input(z.object({ idToken: z.string() }))
    .mutation(async ({ input }) => {
      const { idToken } = input;
      try {
        console.log("Received ID Token:", idToken);
        const decodedClientToken = jwtDecode(idToken);
        console.log("Decoded Client Token:", decodedClientToken);

        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const { uid, email, name } = decodedToken;

        let account = await prisma.account.findUnique({
          where: {
            provider_providerId: {
              provider: "google",
              providerId: uid,
            },
          },
          include: { user: true },
        });

        if (account) {
          return { success: true, user: account.user };
        }

        let user;
        if (email) {
          user = await prisma.user.findUnique({
            where: { email },
          });
        }

        if (user) {
          // Link account to existing user
          await prisma.account.create({
            data: {
              provider: "google",
              providerId: uid,
              userId: user.id,
            },
          });
        } else {
          // Create new user and account
          user = await prisma.user.create({
            data: {
              email: email || null,
              name: name || null,
              accounts: {
                create: {
                  provider: "google",
                  providerId: uid,
                },
              },
            },
          });
        }

        return { success: true, user };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        console.error("Error verifying Google ID token:", message);
        return { success: false, error: message };
      }
    }),
});
