"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { getFirebaseClientFirestore } from "@/lib/firebase/client";
import { subscribeOwnerEvents, type AdminEvent } from "./events/data";
import {
  disablePlan,
  ensureEventAdminProfile,
  formatDateTime,
  formatYearMonth,
  subscribeOwnerPlans,
  type AdminPlan
} from "./plans/data";

const maxActivePlans = 3;

export function AdminPlansScreen() {
  return (
    <ProtectedRoute>
      <AdminPlansDashboard />
    </ProtectedRoute>
  );
}

function AdminPlansDashboard() {
  const { signOut, user } = useAuth();
  const db = useMemo(() => getFirebaseClientFirestore(), []);
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [disablingPlanId, setDisablingPlanId] = useState<string | null>(null);

  useEffect(() => {
    if (!db || !user) {
      return undefined;
    }

    ensureEventAdminProfile(db, {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName
    }).catch(() => {
      setError("イベント管理者情報の初期化に失敗しました。");
    });

    return subscribeOwnerPlans({
      db,
      ownerUid: user.uid,
      onPlans: (nextPlans) => {
        setPlans(nextPlans);
        setIsLoading(false);
      },
      onError: () => {
        setError("プラン一覧の取得に失敗しました。");
        setIsLoading(false);
      }
    });
  }, [db, user]);

  useEffect(() => {
    if (!db || !user) {
      return undefined;
    }

    return subscribeOwnerEvents({
      db,
      ownerUid: user.uid,
      onEvents: setEvents,
      onError: () => {
        setError("イベント件数の取得に失敗しました。");
      }
    });
  }, [db, user]);

  const activePlans = plans.filter((plan) => plan.isActive);
  const inactivePlans = plans.filter((plan) => !plan.isActive);
  const canCreatePlan = activePlans.length < maxActivePlans;
  const activeEventCounts = useMemo(() => {
    return events.reduce<Record<string, number>>((counts, event) => {
      if (!event.isActive) {
        return counts;
      }

      counts[event.planId] = (counts[event.planId] ?? 0) + 1;
      return counts;
    }, {});
  }, [events]);

  async function handleCopyInviteUrl(plan: AdminPlan) {
    setError("");
    setNotice("");

    if (!plan.isActive) {
      setError("無効化済みプランのURLは共有できません。");
      return;
    }

    try {
      await navigator.clipboard.writeText(buildInviteUrl(plan.publicToken));
      setNotice("配信用URLをコピーしました。");
    } catch {
      setError("URLコピーに失敗しました。ブラウザの設定を確認してください。");
    }
  }

  async function handleDisablePlan(plan: AdminPlan) {
    setError("");
    setNotice("");

    const confirmed = window.confirm(
      `「${plan.name}」を無効化します。招待者はこの配信用URLから回答できなくなります。`
    );

    if (!confirmed || !db) {
      return;
    }

    setDisablingPlanId(plan.id);

    try {
      await disablePlan(db, plan.id);
      setNotice("プランを無効化しました。");
    } catch {
      setError("プランの無効化に失敗しました。");
    } finally {
      setDisablingPlanId(null);
    }
  }

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">RSVP Manager</p>
          <h1>プラン一覧</h1>
          <p className="muted-text">{user?.email}</p>
        </div>
        <div className="header-actions">
          <button className="secondary-button" type="button">
            通知を有効にする
          </button>
          <button className="secondary-button" onClick={signOut} type="button">
            ログアウト
          </button>
        </div>
      </header>

      <section className="summary-grid" aria-label="プランサマリー">
        <SummaryCard label="有効プラン" value={`${activePlans.length} / ${maxActivePlans}`} />
        <SummaryCard label="無効プラン" value={String(inactivePlans.length)} />
        <SummaryCard label="全プラン" value={String(plans.length)} />
      </section>

      <section className="panel" aria-labelledby="plans-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Plans</p>
            <h2 id="plans-heading">プラン一覧</h2>
          </div>
          {canCreatePlan ? (
            <Link className="primary-button button-link" href="/admin/plans/new">
              プラン追加
            </Link>
          ) : (
            <button className="primary-button" disabled type="button">
              プラン追加
            </button>
          )}
        </div>

        {!canCreatePlan ? (
          <p className="notice-message top-message">
            有効プランは最大3件までです。不要なプランを無効化すると追加できます。
          </p>
        ) : null}

        {notice ? <p className="success-message top-message">{notice}</p> : null}
        {error ? <p className="error-message top-message">{error}</p> : null}

        {isLoading ? (
          <p className="empty-state">プラン一覧を読み込んでいます。</p>
        ) : plans.length === 0 ? (
          <div className="empty-state">
            <p>まだプランがありません。</p>
            <Link className="primary-button button-link" href="/admin/plans/new">
              最初のプランを追加
            </Link>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>プラン名</th>
                  <th>年月</th>
                  <th>状態</th>
                  <th>イベント数</th>
                  <th>パスワード</th>
                  <th>配信用URL</th>
                  <th>作成日時</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan) => (
                  <tr key={plan.id}>
                    <td className="strong-cell">{plan.name}</td>
                    <td>{formatYearMonth(plan.yearMonth)}</td>
                    <td>
                      <span className={plan.isActive ? "status-badge" : "status-badge muted"}>
                        {plan.isActive ? "有効" : "無効"}
                      </span>
                    </td>
                    <td>{activeEventCounts[plan.id] ?? 0}</td>
                    <td>{plan.hasPassword ? "設定済み" : "未設定"}</td>
                    <td>
                      <button
                        className="secondary-button compact-button"
                        disabled={!plan.isActive}
                        onClick={() => handleCopyInviteUrl(plan)}
                        type="button"
                      >
                        コピー
                      </button>
                    </td>
                    <td>{formatDateTime(plan.createdAt)}</td>
                    <td>
                      <div className="row-actions">
                        <Link
                          className="secondary-button compact-button button-link"
                          href={`/admin/plans/${plan.id}`}
                        >
                          詳細
                        </Link>
                        <button
                          className="danger-button compact-button"
                          disabled={!plan.isActive || disablingPlanId === plan.id}
                          onClick={() => handleDisablePlan(plan)}
                          type="button"
                        >
                          {disablingPlanId === plan.id ? "処理中" : "無効化"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function buildInviteUrl(publicToken: string) {
  return `${window.location.origin}/invite/${publicToken}`;
}
