"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { getFirebaseClientFirestore } from "@/lib/firebase/client";
import { formatYearMonth, subscribeOwnerPlan, type AdminPlan } from "./plans/data";

type UpdatePlanResponse = {
  message?: string;
};

export function EditPlanScreen({ planId }: { planId: string }) {
  return (
    <ProtectedRoute>
      <EditPlanForm planId={planId} />
    </ProtectedRoute>
  );
}

function EditPlanForm({ planId }: { planId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const db = useMemo(() => getFirebaseClientFirestore(), []);
  const [plan, setPlan] = useState<AdminPlan | null>(null);
  const [name, setName] = useState("");
  const [yearMonth, setYearMonth] = useState("");
  const [password, setPassword] = useState("");
  const [clearPassword, setClearPassword] = useState(false);
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
      password,
      clearPassword
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
          password,
          clearPassword
        })
      });
      const result = (await response.json().catch(() => null)) as UpdatePlanResponse | null;

      if (!response.ok) {
        setError(result?.message ?? "プランの更新に失敗しました。");
        return;
      }

      router.push(`/admin/plans/${plan.id}`);
    } catch {
      setError("通信に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isPlanLoading) {
    return (
      <main className="app-shell">
        <section className="panel narrow-panel">
          <p className="eyebrow">Loading</p>
          <h1>プラン情報を読み込んでいます</h1>
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
          <Link className="secondary-button button-link top-message" href="/admin/plans">
            プラン一覧へ戻る
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div>
          <p className="breadcrumb">
            <Link href="/admin/plans">プラン一覧</Link>
            <span> / </span>
            <Link href={`/admin/plans/${plan.id}`}>{plan.name}</Link>
            <span> / プラン編集</span>
          </p>
          <h1>プラン編集</h1>
          <p className="muted-text">
            {plan.name} / {formatYearMonth(plan.yearMonth)}
          </p>
        </div>
        <Link className="secondary-button button-link" href={`/admin/plans/${plan.id}`}>
          プラン詳細へ戻る
        </Link>
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
            プランパスワードの変更は招待者へ自動通知されません。必要に応じてLINE等で連絡してください。
          </div>

          <label className="field">
            <span>新しいプランパスワード</span>
            <input
              autoComplete="new-password"
              disabled={isSubmitting || !plan.isActive || clearPassword}
              maxLength={100}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
            <span className="field-hint">
              未入力のまま保存すると、現在の設定を維持します。
            </span>
          </label>

          {plan.hasPassword ? (
            <label className="checkbox-field">
              <input
                checked={clearPassword}
                disabled={isSubmitting || !plan.isActive}
                onChange={(event) => {
                  setClearPassword(event.target.checked);
                  if (event.target.checked) {
                    setPassword("");
                  }
                }}
                type="checkbox"
              />
              <span>プランパスワードを解除する</span>
            </label>
          ) : null}

          {error ? <p className="error-message">{error}</p> : null}

          <div className="form-actions">
            <button
              className="primary-button"
              disabled={isSubmitting || !plan.isActive}
              type="submit"
            >
              {isSubmitting ? "保存中" : "保存"}
            </button>
            <Link className="secondary-button button-link" href={`/admin/plans/${plan.id}`}>
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
  password: string;
  clearPassword: boolean;
}): { ok: true } | { ok: false; message: string } {
  if (!input.name.trim()) {
    return { ok: false, message: "プラン名を入力してください。" };
  }

  if (input.name.trim().length > 80) {
    return { ok: false, message: "プラン名は80文字以内で入力してください。" };
  }

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.yearMonth)) {
    return { ok: false, message: "年月を選択してください。" };
  }

  if (input.password.length > 100) {
    return { ok: false, message: "プランパスワードは100文字以内で入力してください。" };
  }

  if (input.clearPassword && input.password.length > 0) {
    return {
      ok: false,
      message: "プランパスワードを解除する場合は、新しいパスワードを空にしてください。"
    };
  }

  return { ok: true };
}
