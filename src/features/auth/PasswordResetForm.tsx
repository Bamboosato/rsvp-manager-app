"use client";

import { FirebaseError } from "firebase/app";
import { sendPasswordResetEmail } from "firebase/auth";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useAuth } from "./AuthProvider";

export function PasswordResetForm() {
  const { auth, isConfigured } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isSent, setIsSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSent(false);

    if (!auth || !isConfigured) {
      setError("Firebase設定が未設定のため、リセットメールを送信できません。");
      return;
    }

    setIsSubmitting(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setIsSent(true);
    } catch (caughtError) {
      setError(getPasswordResetErrorMessage(caughtError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="form-stack" onSubmit={handleSubmit}>
      <label className="field">
        <span>メールアドレス</span>
        <input
          autoComplete="email"
          disabled={isSubmitting}
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </label>

      {isSent ? (
        <p className="success-message">
          パスワードリセット用のメールを送信しました。メールに記載された手順に従って再設定してください。
        </p>
      ) : null}

      {error ? <p className="error-message">{error}</p> : null}

      <button
        className="primary-button full-width"
        data-tooltip="パスワード再設定メールを送信"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "送信中" : "リセットメールを送信"}
      </button>

      <Link className="text-link" href="/login">
        ログイン画面へ戻る
      </Link>
    </form>
  );
}

function getPasswordResetErrorMessage(error: unknown) {
  if (error instanceof FirebaseError) {
    if (error.code === "auth/invalid-email") {
      return "メールアドレスの形式が正しくありません。";
    }
  }

  return "リセットメールの送信に失敗しました。時間をおいて再度お試しください。";
}
