import * as express from "express";
import * as admin from "firebase-admin";
import { PrismaClient } from "./generated/prisma";
import { prisma } from "./prisma";

export interface Context {
  prisma: PrismaClient;
  user: {
    id: number;
    email: string | null;
    name: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
}

export const createContext = async ({
  req,
  res,
}: {
  req: express.Request;
  res: express.Response;
}): Promise<Context> => {
  let user: {
    id: number;
    email: string | null;
    name: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null = null;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const idToken = authHeader.split("Bearer ")[1];
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      let provider = "unknown";
      if (decodedToken.firebase?.sign_in_provider) {
        // Map Firebase sign-in providers to simpler strings
        switch (decodedToken.firebase.sign_in_provider) {
          case "google.com":
            provider = "google";
            break;
          case "apple.com":
            provider = "apple";
            break;
          // Add other providers as needed
          default:
            provider = decodedToken.firebase.sign_in_provider.split(".")[0]; // Fallback
        }
      } else if (decodedToken.iss) {
        // Fallback to issuer if sign_in_provider is not available
        if (decodedToken.iss.includes("accounts.google.com")) {
          provider = "google";
        } else if (decodedToken.iss.includes("appleid.apple.com")) {
          provider = "apple";
        }
      }

      const account = await prisma.account.findUnique({
        where: {
          provider_providerId: {
            provider: provider,
            providerId: decodedToken.uid,
          },
        },
        include: { user: true },
      });
      if (account) {
        user = account.user;
      }
    } catch (error) {
      console.error("Error verifying Firebase ID token:", error);
    }
  }
  return { prisma, user };
};
