import { Suspense } from "react";
import { AuthPageShell } from "@/features/auth/AuthPageShell";
import { LoginCloseButton } from "@/features/auth/LoginCloseButton";
import { LoginForm } from "@/features/auth/LoginForm";

export default function LoginPage() {
  return (
    <AuthPageShell
      description="幹事さんアカウントでログインしてください。"
      title="管理画面ログイン"
    >
      <Suspense fallback={null}>
        <LoginCloseButton />
      </Suspense>
      <Suspense fallback={<p className="loading-inline">読み込み中...</p>}>
        <LoginForm />
      </Suspense>
    </AuthPageShell>
  );
}
