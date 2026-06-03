"use client";

import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";
import { useAuth } from "./AuthProvider";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isConfigured, isLoading, user } = useAuth();

  useEffect(() => {
    if (isConfigured && !isLoading && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [isConfigured, isLoading, pathname, router, user]);

  if (!isConfigured) {
    return (
      <main className="app-shell">
        <section className="panel narrow-panel">
          <p className="eyebrow">Configuration</p>
          <h1>Firebase設定が必要です</h1>
          <p className="muted-text">
            `.env.local` にFirebase Web Appの設定値を登録すると、イベント管理者ログインを利用できます。
          </p>
        </section>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="app-shell">
        <section className="loading-panel" role="status" aria-live="polite">
          読み込み中...
        </section>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
