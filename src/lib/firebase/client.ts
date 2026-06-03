import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import type { Messaging } from "firebase/messaging";

type FirebaseClientConfig = {
  apiKey: string | undefined;
  authDomain: string | undefined;
  projectId: string | undefined;
  storageBucket: string | undefined;
  messagingSenderId: string | undefined;
  appId: string | undefined;
};

const firebaseConfig: FirebaseClientConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

export function hasFirebaseClientConfig() {
  return Object.values(firebaseConfig).every(Boolean);
}

export function getFirebaseClientApp(): FirebaseApp | null {
  if (!hasFirebaseClientConfig()) {
    return null;
  }

  return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
}

export function getFirebaseClientAuth(): Auth | null {
  const app = getFirebaseClientApp();
  return app ? getAuth(app) : null;
}

export function getFirebaseClientFirestore(): Firestore | null {
  const app = getFirebaseClientApp();
  return app ? getFirestore(app) : null;
}

export async function getFirebaseClientMessaging(): Promise<Messaging | null> {
  if (typeof window === "undefined") {
    return null;
  }

  const app = getFirebaseClientApp();

  if (!app) {
    return null;
  }

  const { getMessaging, isSupported } = await import("firebase/messaging");
  const supported = await isSupported().catch(() => false);

  return supported ? getMessaging(app) : null;
}
