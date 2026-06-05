"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { RequiredMark, RequiredNote } from "@/features/ui/RequiredMark";
import { AdminAccountMenu } from "./AdminAccountMenu";

type AccessCodeMode = "none" | "set";

export function NewPlanScreen() {
  return (
    <ProtectedRoute>
      <NewPlanForm />
    </ProtectedRoute>
  );
}

function NewPlanForm() {
  const router = useRouter();
  const { signOut, user } = useAuth();
  const [accessCodeMode, setAccessCodeMode] = useState<AccessCodeMode>("none");
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "");
    const yearMonth = String(formData.get("yearMonth") ?? "");
    const validation = validateAccessCodeInput({
      accessCode,
      accessCodeMode
    });

    if (!validation.ok) {
      setError(validation.message);
      return;
    }

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
          accessCode: validation.accessCode
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
        <div className="page-heading">
          <div className="title-row">
            <Link className="back-link" data-tooltip="マイプランへ戻る" href="/admin/plans">
              <span>←</span>
              <span>戻る</span>
            </Link>
            <h1>プラン追加</h1>
          </div>
        </div>
        <AdminAccountMenu user={user} onSignOut={signOut} />
      </header>

      <section className="panel narrow-panel" aria-labelledby="new-plan-heading">
        <div className="section-heading stacked-heading">
          <div>
            <p className="eyebrow">New Plan</p>
            <h2 id="new-plan-heading">プラン情報</h2>
          </div>
        </div>

        <form className="form-stack" onSubmit={handleSubmit}>
          <RequiredNote />

          <label className="field">
            <span>
              プラン名
              <RequiredMark />
            </span>
            <input
              disabled={isSubmitting}
              maxLength={80}
              name="name"
              placeholder="例）7月イベント"
              required
              type="text"
            />
          </label>

          <label className="field">
            <span>
              年月
              <RequiredMark />
            </span>
            <input
              defaultValue={getCurrentYearMonth()}
              disabled={isSubmitting}
              name="yearMonth"
              required
              type="month"
            />
          </label>

          <fieldset className="option-fieldset">
            <legend>アクセスコード</legend>
            <p className="field-hint">
              設定した場合、招待者は共有URLアクセス時に入力が必要です。6〜12桁の数字で入力してください。
            </p>
            <div className="radio-group">
              <label className="radio-field">
                <input
                  checked={accessCodeMode === "none"}
                  disabled={isSubmitting}
                  onChange={() => {
                    setAccessCodeMode("none");
                    setAccessCode("");
                  }}
                  type="radio"
                />
                <span>アクセスコードを設定しない</span>
              </label>
              <label className="radio-field">
                <input
                  checked={accessCodeMode === "set"}
                  disabled={isSubmitting}
                  onChange={() => setAccessCodeMode("set")}
                  type="radio"
                />
                <span>アクセスコードを設定する</span>
              </label>
            </div>
            {accessCodeMode === "set" ? (
              <label className="field nested-field">
                <span>
                  アクセスコード
                  <RequiredMark />
                </span>
                <input
                  autoComplete="new-password"
                  disabled={isSubmitting}
                  inputMode="numeric"
                  maxLength={12}
                  onChange={(event) => setAccessCode(event.target.value)}
                  pattern="[0-9]*"
                  placeholder="例）123456"
                  type="text"
                  value={accessCode}
                />
                <span className="field-hint">6〜12桁の数字</span>
              </label>
            ) : null}
          </fieldset>

          {error ? <p className="error-message">{error}</p> : null}

          <div className="form-actions">
            <button
              className="primary-button"
              data-tooltip="プランを作成"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "保存中" : "保存"}
            </button>
            <Link
              className="secondary-button button-link"
              data-tooltip="作成せずにマイプランへ戻る"
              href="/admin/plans"
            >
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

function validateAccessCodeInput(input: {
  accessCode: string;
  accessCodeMode: AccessCodeMode;
}):
  | { ok: true; accessCode: string }
  | { ok: false; message: string } {
  const accessCode = input.accessCode.trim();

  if (input.accessCodeMode === "none") {
    return { ok: true, accessCode: "" };
  }

  if (!accessCode) {
    return { ok: false, message: "アクセスコードを入力してください。" };
  }

  if (!/^\d{6,12}$/.test(accessCode)) {
    return { ok: false, message: "アクセスコードは6〜12桁の数字で入力してください。" };
  }

  return { ok: true, accessCode };
}
