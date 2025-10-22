import * as admin from "firebase-admin";
import { z } from "zod";
import { prisma } from "../../prisma";
import { protectedProcedure, publicProcedure, router } from "../../trpc";
import { ErrorResponse, SuccessResponse } from "../../types/type";

export const authRouter = router({
  firebaseSignIn: publicProcedure
    .input(z.object({ idToken: z.string() }))
    .mutation(
      async ({ input }): Promise<SuccessResponse<any> | ErrorResponse> => {
        const { idToken } = input;
        try {
          const decodedToken = await admin.auth().verifyIdToken(idToken);
          const { uid, email, name } = decodedToken;

          const provider = decodedToken.firebase.sign_in_provider;

          let account = await prisma.account.findUnique({
            where: {
              provider_providerId: {
                provider: provider,
                providerId: uid,
              },
            },
          });

          if (account) {
            let user = await prisma.user.findUnique({
              where: { id: account.userId },
            });

            if (user) {
              console.log("User deletedAt before check:", user.deletedAt);
              // If user is soft-deleted, reactivate them
              if (user.deletedAt !== null) {
                console.log("User is soft-deleted. Reactivating...");
                const updatedUser = await prisma.user.update({
                  where: { id: user.id },
                  data: { deletedAt: null },
                });
                user = updatedUser; // Update the user object with the reactivated user
                console.log(
                  "User reactivated. User deletedAt after update:",
                  user.deletedAt
                );
              }
              return { success: true, data: user };
            } else {
              // This case should ideally not happen if referential integrity is maintained
              console.error("Account found but no associated user.");
              return {
                success: false,
                errorCode: 500,
                errorMessage: "Associated user not found.",
              };
            }
          }

          let user;
          if (email) {
            user = await prisma.user.findUnique({
              where: { email },
            });
          }

          if (user) {
            // If user is soft-deleted, reactivate them
            if (user.deletedAt !== null) {
              console.log(
                "User found by email is soft-deleted. Reactivating..."
              );
              user = await prisma.user.update({
                where: { id: user.id },
                data: { deletedAt: null },
              });
              console.log(
                "User reactivated. User deletedAt after update:",
                user.deletedAt
              );
            }
            // Link account to existing user
            await prisma.account.create({
              data: {
                provider: provider,
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
                    provider: provider,
                    providerId: uid,
                  },
                },
              },
            });
          }

          return { success: true, data: user };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown error";
          console.error("Error verifying Firebase ID token:", message);
          return { success: false, errorCode: 500, errorMessage: message };
        }
      }
    ),

  deleteUser: protectedProcedure.mutation(
    async ({ ctx }): Promise<SuccessResponse | ErrorResponse> => {
      const userId = ctx.user.id;
      try {
        console.log("Attempting to soft-delete user with ID:", userId);
        const updatedUser = await prisma.user.update({
          where: {
            id: userId,
          },
          data: {
            deletedAt: new Date(),
          },
        });
        console.log(
          "User soft-deleted. New deletedAt value:",
          updatedUser.deletedAt
        );

        return { success: true, data: undefined };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        console.error("Error soft-deleting user:", message);
        return { success: false, errorCode: 500, errorMessage: message };
      }
    }
  ),
});
