"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import {
  getNotificationButtonLabel,
  useAdminPushNotifications
} from "@/features/notifications/useAdminPushNotifications";
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
  const pushNotifications = useAdminPushNotifications(user);
  const db = useMemo(() => getFirebaseClientFirestore(), []);
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copiedPlanId, setCopiedPlanId] = useState<string | null>(null);
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);
  const copyFeedbackTimerRef = useRef<number | null>(null);

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
    return () => {
      if (copyFeedbackTimerRef.current) {
        window.clearTimeout(copyFeedbackTimerRef.current);
      }
    };
  }, []);

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

    try {
      await navigator.clipboard.writeText(buildInviteUrl(plan.publicToken));
      showCopyFeedback(plan.id);
    } catch {
      setError("URLコピーに失敗しました。ブラウザの設定を確認してください。");
    }
  }

  function showCopyFeedback(planId: string) {
    setCopiedPlanId(planId);

    if (copyFeedbackTimerRef.current) {
      window.clearTimeout(copyFeedbackTimerRef.current);
    }

    copyFeedbackTimerRef.current = window.setTimeout(() => {
      setCopiedPlanId((currentPlanId) => (currentPlanId === planId ? null : currentPlanId));
      copyFeedbackTimerRef.current = null;
    }, 3000);
  }

  async function handleDisablePlan(plan: AdminPlan) {
    setError("");
    setNotice("");

    const confirmed = window.confirm(
      `プラン「${plan.name}」を削除します。招待URLからもアクセスできなくなります。よろしいですか？`
    );

    if (!confirmed || !db) {
      return;
    }

    setDeletingPlanId(plan.id);

    try {
      await disablePlan(db, plan.id);
      setNotice("プランを削除しました。");
    } catch {
      setError("プランの削除に失敗しました。");
    } finally {
      setDeletingPlanId(null);
    }
  }

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">RSVP Hub</p>
          <h1>プラン一覧</h1>
          <p className="muted-text">{user?.email}</p>
        </div>
        <div className="header-actions">
          <button
            className="secondary-button"
            disabled={
              pushNotifications.status === "requesting" ||
              pushNotifications.status === "enabled" ||
              pushNotifications.status === "unsupported" ||
              pushNotifications.status === "missing-key"
            }
            onClick={() => pushNotifications.enableNotifications()}
            title={pushNotifications.message || undefined}
            type="button"
          >
            {getNotificationButtonLabel(pushNotifications.status)}
          </button>
          <button className="secondary-button" onClick={signOut} type="button">
            ログアウト
          </button>
        </div>
      </header>

      <section className="summary-grid" aria-label="プランサマリー">
        <SummaryCard label="プラン数" value={`${activePlans.length} / ${maxActivePlans}`} />
        <SummaryCard
          label="イベント数"
          value={String(
            activePlans.reduce((total, plan) => total + (activeEventCounts[plan.id] ?? 0), 0)
          )}
        />
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
            プランは最大3件までです。不要なプランを削除すると追加できます。
          </p>
        ) : null}

        {notice ? <p className="success-message top-message">{notice}</p> : null}
        {error ? <p className="error-message top-message">{error}</p> : null}

        {isLoading ? (
          <p className="empty-state">プラン一覧を読み込んでいます。</p>
        ) : activePlans.length === 0 ? (
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
                  <th>イベント数</th>
                  <th>アクセスコード</th>
                  <th>配信用URL</th>
                  <th>作成日時</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {activePlans.map((plan) => (
                  <tr key={plan.id}>
                    <td className="strong-cell">{plan.name}</td>
                    <td>{formatYearMonth(plan.yearMonth)}</td>
                    <td>{activeEventCounts[plan.id] ?? 0}</td>
                    <td>{plan.hasPassword ? "設定済み" : "未設定"}</td>
                    <td>
                      <div className="copy-feedback-wrap">
                        <button
                          className="secondary-button compact-button"
                          onClick={() => handleCopyInviteUrl(plan)}
                          type="button"
                        >
                          コピー
                        </button>
                        {copiedPlanId === plan.id ? (
                          <span className="copy-feedback" role="status">
                            コピーしました
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td>{formatDateTime(plan.createdAt)}</td>
                    <td>
                      <div className="row-actions">
                        <Link
                          className="secondary-button compact-button button-link"
                          href={`/admin/plans/${plan.id}`}
                        >
                          イベント
                        </Link>
                        <Link
                          className="secondary-button compact-button button-link"
                          href={`/admin/plans/${plan.id}/edit`}
                        >
                          編集
                        </Link>
                        <button
                          className="danger-button compact-button"
                          disabled={deletingPlanId === plan.id}
                          onClick={() => handleDisablePlan(plan)}
                          type="button"
                        >
                          {deletingPlanId === plan.id ? "処理中" : "削除"}
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
