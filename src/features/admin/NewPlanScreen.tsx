"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";

export function NewPlanScreen() {
  return (
    <ProtectedRoute>
      <NewPlanForm />
    </ProtectedRoute>
  );
}

function NewPlanForm() {
  const router = useRouter();
  const { user } = useAuth();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "");
    const yearMonth = String(formData.get("yearMonth") ?? "");
    const password = String(formData.get("password") ?? "");

    if (!user) {
      setError("ログイン状態を確認できません。再度ログインしてください。");
      return;
    }

    setIsSubmitting(true);

    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/admin/plans", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name,
          yearMonth,
          password
        })
      });
      const result = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;

      if (!response.ok) {
        setError(result?.message ?? "プランの作成に失敗しました。");
        return;
      }

      router.push("/admin/plans");
    } catch {
      setError("通信に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">Plans</p>
          <h1>プラン追加</h1>
        </div>
        <Link className="secondary-button button-link" href="/admin/plans">
          プラン一覧へ戻る
        </Link>
      </header>

      <section className="panel narrow-panel" aria-labelledby="new-plan-heading">
        <div className="section-heading stacked-heading">
          <div>
            <p className="eyebrow">New Plan</p>
            <h2 id="new-plan-heading">プラン情報</h2>
          </div>
        </div>

        <form className="form-stack" onSubmit={handleSubmit}>
          <label className="field">
            <span>プラン名</span>
            <input
              disabled={isSubmitting}
              maxLength={80}
              name="name"
              required
              type="text"
            />
          </label>

          <label className="field">
            <span>年月</span>
            <input
              defaultValue={getCurrentYearMonth()}
              disabled={isSubmitting}
              name="yearMonth"
              required
              type="month"
            />
          </label>

          <label className="field">
            <span>プランパスワード（任意）</span>
            <input
              autoComplete="new-password"
              disabled={isSubmitting}
              maxLength={100}
              name="password"
              type="password"
            />
            <span className="field-hint">
              設定した場合、招待者は配信用URLアクセス時に入力が必要です。
            </span>
          </label>

          {error ? <p className="error-message">{error}</p> : null}

          <div className="form-actions">
            <button className="primary-button" disabled={isSubmitting} type="submit">
              {isSubmitting ? "保存中" : "保存"}
            </button>
            <Link className="secondary-button button-link" href="/admin/plans">
              キャンセル
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}

function getCurrentYearMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}
