"use client";

import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  type Auth,
  type User
} from "firebase/auth";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import {
  getFirebaseClientAuth,
  hasFirebaseClientConfig
} from "@/lib/firebase/client";

type AuthContextValue = {
  auth: Auth | null;
  user: User | null;
  isConfigured: boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth] = useState(() => getFirebaseClientAuth());
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(() => Boolean(auth));
  const isConfigured = hasFirebaseClientConfig();

  useEffect(() => {
    if (!auth) {
      return undefined;
    }

    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setIsLoading(false);
    });
  }, [auth]);

  const value = useMemo<AuthContextValue>(
    () => ({
      auth,
      user,
      isConfigured,
      isLoading,
      signOut: async () => {
        if (auth) {
          await firebaseSignOut(auth);
        }
      }
    }),
    [auth, isConfigured, isLoading, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
