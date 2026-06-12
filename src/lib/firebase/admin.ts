import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { getStorage } from "firebase-admin/storage";

function ensureFirebaseAdminApp() {
  if (!getApps().length) {
    const projectId =
      process.env.FIREBASE_ADMIN_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
    const storageBucket =
      process.env.FIREBASE_ADMIN_STORAGE_BUCKET ?? process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error("Missing Firebase Admin SDK environment variables.");
    }

    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey
      }),
      ...(storageBucket ? { storageBucket } : {})
    });
  }
}

export function getFirebaseAdminFirestore() {
  ensureFirebaseAdminApp();
  return getFirestore();
}

export function getFirebaseAdminMessaging() {
  ensureFirebaseAdminApp();
  return getMessaging();
}

export function getFirebaseAdminStorageBucket() {
  ensureFirebaseAdminApp();
  return getStorage().bucket();
}
