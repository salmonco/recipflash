import { NextFunction, Request, Response } from "express";
import * as admin from "firebase-admin";
import { prisma } from "../prisma";

export interface AuthenticatedRequest extends Request {
  userId?: number;
}

export const authenticateUser = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).send({ error: "UNAUTHORIZED" });
  }

  const idToken = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    let provider: string;
    if (decodedToken.firebase?.sign_in_provider) {
      provider = decodedToken.firebase.sign_in_provider;
    } else {
      provider = "firebase"; // Generic fallback if sign_in_provider is not explicitly set
    }

    const account = await prisma.account.findUnique({
      where: {
        provider_providerId: {
          provider: provider,
          providerId: decodedToken.uid,
        },
      },
    });

    if (account) {
      req.userId = account.userId;
      next();
    } else {
      res.status(401).send({ error: "UNAUTHORIZED" });
    }
  } catch (error) {
    console.error("Error verifying Firebase ID token:", error);
    res.status(401).send({ error: "UNAUTHORIZED" });
  }
};
