"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { getFirebaseClientFirestore } from "@/lib/firebase/client";
import { AdminAccountMenu } from "./AdminAccountMenu";
import { subscribeOwnerPlan, type AdminPlan } from "./plans/data";

type UpdatePlanResponse = {
  message?: string;
};

type AccessCodeAction = "keep" | "clear" | "change" | "none" | "set";

export function EditPlanScreen({ planId }: { planId: string }) {
  return (
    <ProtectedRoute>
      <EditPlanForm planId={planId} />
    </ProtectedRoute>
  );
}

function EditPlanForm({ planId }: { planId: string }) {
  const router = useRouter();
  const { signOut, user } = useAuth();
  const db = useMemo(() => getFirebaseClientFirestore(), []);
  const [plan, setPlan] = useState<AdminPlan | null>(null);
  const [name, setName] = useState("");
  const [yearMonth, setYearMonth] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [accessCodeAction, setAccessCodeAction] = useState<AccessCodeAction>("none");
  const [isPlanLoading, setIsPlanLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!db || !user) {
      return undefined;
    }

    return subscribeOwnerPlan({
      db,
      ownerUid: user.uid,
      planId,
      onPlan: (nextPlan) => {
        setPlan(nextPlan);
        setName(nextPlan?.name ?? "");
        setYearMonth(nextPlan?.yearMonth ?? "");
        setAccessCode("");
        setAccessCodeAction(nextPlan?.hasPassword ? "keep" : "none");
        setIsPlanLoading(false);
      },
      onError: () => {
        setError("プラン情報の取得に失敗しました。");
        setIsPlanLoading(false);
      }
    });
  }, [db, planId, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!user || !plan) {
      setError("プラン情報を確認できません。");
      return;
    }

    if (!plan.isActive) {
      setError("無効化済みプランは編集できません。");
      return;
    }

    const validation = validatePlanInput({
      name,
      yearMonth,
      accessCode,
      accessCodeAction,
      hasAccessCode: plan.hasPassword
    });

    if (!validation.ok) {
      setError(validation.message);
      return;
    }

    setIsSubmitting(true);

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/admin/plans/${plan.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name,
          yearMonth,
          accessCode: validation.accessCode,
          clearAccessCode: validation.clearAccessCode
        })
      });
      const result = (await response.json().catch(() => null)) as UpdatePlanResponse | null;

      if (!response.ok) {
        setError(result?.message ?? "プランの更新に失敗しました。");
        return;
      }

      router.push("/admin/plans");
    } catch {
      setError("通信に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isPlanLoading) {
    return (
      <main className="app-shell">
        <section className="loading-panel" role="status" aria-live="polite">
          読み込み中...
        </section>
      </main>
    );
  }

  if (!plan) {
    return (
      <main className="app-shell">
        <section className="panel narrow-panel">
          <p className="eyebrow">Not Found</p>
          <h1>プランを表示できません</h1>
          <p className="muted-text">
            プランが存在しないか、ログイン中のイベント管理者では閲覧できません。
          </p>
          <Link
            className="secondary-button button-link top-message"
            data-tooltip="プラン一覧へ戻る"
            href="/admin/plans"
          >
            プラン一覧へ戻る
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div className="page-heading">
          <div className="title-row">
            <Link className="back-link" data-tooltip="プラン一覧へ戻る" href="/admin/plans">
              <span>←</span>
              <span>戻る</span>
            </Link>
            <h1>プラン編集</h1>
          </div>
        </div>
        <AdminAccountMenu user={user} onSignOut={signOut} />
      </header>

      <section className="panel narrow-panel" aria-labelledby="edit-plan-heading">
        <div className="section-heading stacked-heading">
          <div>
            <p className="eyebrow">Edit Plan</p>
            <h2 id="edit-plan-heading">プラン情報</h2>
          </div>
        </div>

        {!plan.isActive ? (
          <p className="notice-message">
            無効化済みプランのため、プラン情報は編集できません。
          </p>
        ) : null}

        <form className="form-stack" onSubmit={handleSubmit}>
          <label className="field">
            <span>プラン名</span>
            <input
              disabled={isSubmitting || !plan.isActive}
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
              required
              type="text"
              value={name}
            />
          </label>

          <label className="field">
            <span>年月</span>
            <input
              disabled={isSubmitting || !plan.isActive}
              onChange={(event) => setYearMonth(event.target.value)}
              required
              type="month"
              value={yearMonth}
            />
          </label>

          <div className="notice-message">
            アクセスコードの変更は招待者へ自動通知されません。必要に応じてLINE等で連絡してください。
          </div>

          <fieldset className="option-fieldset">
            <legend>アクセスコード</legend>
            <p className="setting-summary">
              現在の設定：{plan.hasPassword ? "アクセスコードあり" : "アクセスコードなし"}
            </p>
            <p className="field-hint">アクセスコードは6〜12桁の数字で入力してください。</p>
            <div className="radio-group">
              {plan.hasPassword ? (
                <>
                  <label className="radio-field">
                    <input
                      checked={accessCodeAction === "keep"}
                      disabled={isSubmitting || !plan.isActive}
                      onChange={() => {
                        setAccessCodeAction("keep");
                        setAccessCode("");
                      }}
                      type="radio"
                    />
                    <span>現在のアクセスコードを維持する</span>
                  </label>
                  <label className="radio-field">
                    <input
                      checked={accessCodeAction === "clear"}
                      disabled={isSubmitting || !plan.isActive}
                      onChange={() => {
                        setAccessCodeAction("clear");
                        setAccessCode("");
                      }}
                      type="radio"
                    />
                    <span>アクセスコードを解除する</span>
                  </label>
                  <label className="radio-field">
                    <input
                      checked={accessCodeAction === "change"}
                      disabled={isSubmitting || !plan.isActive}
                      onChange={() => setAccessCodeAction("change")}
                      type="radio"
                    />
                    <span>別のアクセスコードを設定する</span>
                  </label>
                </>
              ) : (
                <>
                  <label className="radio-field">
                    <input
                      checked={accessCodeAction === "none"}
                      disabled={isSubmitting || !plan.isActive}
                      onChange={() => {
                        setAccessCodeAction("none");
                        setAccessCode("");
                      }}
                      type="radio"
                    />
                    <span>アクセスコードを設定しない</span>
                  </label>
                  <label className="radio-field">
                    <input
                      checked={accessCodeAction === "set"}
                      disabled={isSubmitting || !plan.isActive}
                      onChange={() => setAccessCodeAction("set")}
                      type="radio"
                    />
                    <span>アクセスコードを設定する</span>
                  </label>
                </>
              )}
            </div>
            {accessCodeAction === "change" || accessCodeAction === "set" ? (
              <label className="field nested-field">
                <span>アクセスコード</span>
                <input
                  autoComplete="new-password"
                  disabled={isSubmitting || !plan.isActive}
                  inputMode="numeric"
                  maxLength={12}
                  onChange={(event) => setAccessCode(event.target.value)}
                  pattern="[0-9]*"
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
              data-tooltip="プラン情報を保存"
              disabled={isSubmitting || !plan.isActive}
              type="submit"
            >
              {isSubmitting ? "保存中" : "保存"}
            </button>
            <Link
              className="secondary-button button-link"
              data-tooltip="変更せずにプラン一覧へ戻る"
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

function validatePlanInput(input: {
  name: string;
  yearMonth: string;
  accessCode: string;
  accessCodeAction: AccessCodeAction;
  hasAccessCode: boolean;
}):
  | { ok: true; accessCode: string; clearAccessCode: boolean }
  | { ok: false; message: string } {
  if (!input.name.trim()) {
    return { ok: false, message: "プラン名を入力してください。" };
  }

  if (input.name.trim().length > 80) {
    return { ok: false, message: "プラン名は80文字以内で入力してください。" };
  }

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.yearMonth)) {
    return { ok: false, message: "年月を選択してください。" };
  }

  if (input.hasAccessCode) {
    if (
      input.accessCodeAction !== "keep" &&
      input.accessCodeAction !== "clear" &&
      input.accessCodeAction !== "change"
    ) {
      return { ok: false, message: "アクセスコードの操作を選択してください。" };
    }

    if (input.accessCodeAction === "keep") {
      return { ok: true, accessCode: "", clearAccessCode: false };
    }

    if (input.accessCodeAction === "clear") {
      return { ok: true, accessCode: "", clearAccessCode: true };
    }

    return validateAccessCode(input.accessCode);
  }

  if (input.accessCodeAction !== "none" && input.accessCodeAction !== "set") {
    return { ok: false, message: "アクセスコードの操作を選択してください。" };
  }

  if (input.accessCodeAction === "none") {
    return { ok: true, accessCode: "", clearAccessCode: false };
  }

  return validateAccessCode(input.accessCode);
}

function validateAccessCode(accessCodeValue: string):
  | { ok: true; accessCode: string; clearAccessCode: false }
  | { ok: false; message: string } {
  const accessCode = accessCodeValue.trim();

  if (!accessCode) {
    return { ok: false, message: "アクセスコードを入力してください。" };
  }

  if (!/^\d{6,12}$/.test(accessCode)) {
    return {
      ok: false,
      message: "アクセスコードは6〜12桁の数字で入力してください。"
    };
  }

  return { ok: true, accessCode, clearAccessCode: false };
}
