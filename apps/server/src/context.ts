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
      console.log("Decoded Firebase ID Token:", decodedToken);

      let provider: string;
      if (decodedToken.firebase?.sign_in_provider) {
        provider = decodedToken.firebase.sign_in_provider;
      } else {
        provider = "firebase"; // Generic fallback if sign_in_provider is not explicitly set
      }
      console.log("Determined Provider:", provider);

      const account = await prisma.account.findUnique({
        where: {
          provider_providerId: {
            provider: provider,
            providerId: decodedToken.uid,
          },
        },
        include: { user: true },
      });
      console.log("Found Account:", account);
      if (account) {
        user = account.user;
      }
    } catch (error) {
      console.error("Error verifying Firebase ID token:", error);
    }
  }
  return { prisma, user };
};
