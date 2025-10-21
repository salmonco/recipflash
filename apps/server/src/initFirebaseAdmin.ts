import * as admin from "firebase-admin";

export const initFirebaseAdmin = () => {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    });
  } else {
    console.error(
      "FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set."
    );
  }
};
