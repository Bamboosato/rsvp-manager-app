import { AuthPageShell } from "@/features/auth/AuthPageShell";
import { PasswordResetForm } from "@/features/auth/PasswordResetForm";

export default function PasswordResetPage() {
  return (
    <AuthPageShell
      description="登録済みメールアドレスへパスワードリセット用のメールを送信します。"
      title="パスワードリセット"
    >
      <PasswordResetForm />
    </AuthPageShell>
  );
}
