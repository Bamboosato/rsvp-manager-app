import { Suspense } from "react";
import { AuthPageShell } from "@/features/auth/AuthPageShell";
import { LoginForm } from "@/features/auth/LoginForm";

export default function LoginPage() {
  return (
    <AuthPageShell
      description="イベント管理者アカウントでログインしてください。"
      title="管理画面ログイン"
    >
      <Suspense fallback={<p className="loading-inline">読み込み中...</p>}>
        <LoginForm />
      </Suspense>
    </AuthPageShell>
  );
}
