import * as admin from "firebase-admin";
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import { jwtDecode } from "jwt-decode";
import { z } from "zod";
import { prisma } from "../../prisma";
import { publicProcedure, router } from "../../trpc";

const client = jwksClient({
  jwksUri: "https://appleid.apple.com/auth/keys",
});

const getKey = (header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) => {
  if (!header.kid) {
    return callback(new Error("No kid in header"));
  }
  client.getSigningKey(header.kid, (err, key) => {
    if (err || !key) {
      return callback(err || new Error("Could not get signing key"));
    }
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
};

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

  appleLogin: publicProcedure
    .input(z.object({ identityToken: z.string(), name: z.string().nullable() }))
    .mutation(async ({ input }) => {
      const { identityToken, name } = input;
      try {
        const decoded = await new Promise<jwt.JwtPayload>((resolve, reject) => {
          jwt.verify(identityToken, getKey, {}, (err, decoded) => {
            if (err) {
              return reject(err);
            }
            resolve(decoded as jwt.JwtPayload);
          });
        });

        const { sub: appleUserId, email } = decoded;

        if (!appleUserId) {
          throw new Error("Apple token is invalid: missing user ID");
        }

        let account = await prisma.account.findUnique({
          where: {
            provider_providerId: {
              provider: "apple",
              providerId: appleUserId,
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
          await prisma.account.create({
            data: {
              provider: "apple",
              providerId: appleUserId,
              userId: user.id,
            },
          });
        } else {
          user = await prisma.user.create({
            data: {
              email: email || null,
              name: name || null,
              accounts: {
                create: {
                  provider: "apple",
                  providerId: appleUserId,
                },
              },
            },
          });
        }

        return { success: true, user };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        console.error("Error verifying Apple ID token:", message);
        return { success: false, error: message };
      }
    }),
});
