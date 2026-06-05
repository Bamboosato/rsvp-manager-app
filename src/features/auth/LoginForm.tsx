"use client";

import { FirebaseError } from "firebase/app";
import { signInWithEmailAndPassword } from "firebase/auth";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { RequiredMark, RequiredNote } from "@/features/ui/RequiredMark";
import { useAuth } from "./AuthProvider";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { auth, isConfigured, isLoading, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const requestedNextPath = searchParams.get("next");
  const nextPath = requestedNextPath?.startsWith("/")
    ? requestedNextPath
    : "/admin/plans";

  useEffect(() => {
    if (user) {
      router.replace(nextPath);
    }
  }, [nextPath, router, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!auth || !isConfigured) {
      setError("Firebase設定が未設定のため、ログインできません。");
      return;
    }

    setIsSubmitting(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.replace(nextPath);
    } catch (caughtError) {
      setError(getLoginErrorMessage(caughtError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="form-stack" onSubmit={handleSubmit}>
      <RequiredNote />

      {!isConfigured ? (
        <p className="notice-message">
          Firebase設定が未設定です。`.env.local` にFirebase Web Appの設定値を登録してください。
        </p>
      ) : null}

      <label className="field">
        <span>
          メールアドレス
          <RequiredMark />
        </span>
        <input
          autoComplete="email"
          disabled={isLoading || isSubmitting}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="例）name@example.com"
          required
          type="email"
          value={email}
        />
      </label>

      <label className="field">
        <span>
          パスワード
          <RequiredMark />
        </span>
        <input
          autoComplete="current-password"
          disabled={isLoading || isSubmitting}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="パスワード"
          required
          type="password"
          value={password}
        />
      </label>

      {error ? <p className="error-message">{error}</p> : null}

      <button
        className="primary-button full-width"
        data-tooltip="管理画面にログイン"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "ログイン中" : "ログイン"}
      </button>

      <Link className="text-link" href="/password-reset">
        パスワードを忘れた場合
      </Link>
    </form>
  );
}

function getLoginErrorMessage(error: unknown) {
  if (error instanceof FirebaseError) {
    if (
      error.code === "auth/invalid-credential" ||
      error.code === "auth/user-not-found" ||
      error.code === "auth/wrong-password"
    ) {
      return "メールアドレスまたはパスワードが正しくありません。";
    }

    if (error.code === "auth/too-many-requests") {
      return "ログイン試行が多すぎます。時間をおいて再度お試しください。";
    }
  }

  return "ログインに失敗しました。時間をおいて再度お試しください。";
}
