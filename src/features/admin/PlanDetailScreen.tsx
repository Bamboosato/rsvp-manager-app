"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { getFirebaseClientFirestore } from "@/lib/firebase/client";
import {
  disableEvent,
  formatEventDate,
  getEventStatusLabel,
  getNextEventStatus,
  subscribePlanEvents,
  updateEventStatus,
  type AdminEvent
} from "./events/data";
import {
  formatDateTime,
  formatYearMonth,
  subscribeOwnerPlan,
  type AdminPlan
} from "./plans/data";
import {
  buildEventSummaryMap,
  subscribePlanResponses,
  type AdminResponse
} from "./responses/data";

export function PlanDetailScreen({ planId }: { planId: string }) {
  return (
    <ProtectedRoute>
      <PlanDetail planId={planId} />
    </ProtectedRoute>
  );
}

function PlanDetail({ planId }: { planId: string }) {
  const { signOut, user } = useAuth();
  const db = useMemo(() => getFirebaseClientFirestore(), []);
  const [plan, setPlan] = useState<AdminPlan | null>(null);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [responses, setResponses] = useState<AdminResponse[]>([]);
  const [isPlanLoading, setIsPlanLoading] = useState(true);
  const [isEventsLoading, setIsEventsLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [updatingEventId, setUpdatingEventId] = useState<string | null>(null);

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
        setIsPlanLoading(false);
      },
      onError: () => {
        setError("プラン情報の取得に失敗しました。");
        setIsPlanLoading(false);
      }
    });
  }, [db, planId, user]);

  useEffect(() => {
    if (!db || !user || !plan) {
      return undefined;
    }

    return subscribePlanEvents({
      db,
      ownerUid: user.uid,
      planId: plan.id,
      onEvents: (nextEvents) => {
        setEvents(nextEvents);
        setIsEventsLoading(false);
      },
      onError: () => {
        setError("イベント一覧の取得に失敗しました。");
        setIsEventsLoading(false);
      }
    });
  }, [db, plan, user]);

  useEffect(() => {
    if (!db || !user || !plan) {
      return undefined;
    }

    return subscribePlanResponses({
      db,
      ownerUid: user.uid,
      planId: plan.id,
      onResponses: setResponses,
      onError: () => {
        setError("出欠サマリーの取得に失敗しました。");
      }
    });
  }, [db, plan, user]);

  const acceptingCount = events.filter((event) => event.status === "accepting").length;
  const closedCount = events.filter((event) => event.status === "closed").length;
  const eventSummaryMap = useMemo(
    () => buildEventSummaryMap(responses),
    [responses]
  );

  async function handleCopyInviteUrl() {
    setError("");
    setNotice("");

    if (!plan?.isActive) {
      setError("無効化済みプランのURLは共有できません。");
      return;
    }

    try {
      await navigator.clipboard.writeText(`${window.location.origin}/invite/${plan.publicToken}`);
      setNotice("配信用URLをコピーしました。");
    } catch {
      setError("URLコピーに失敗しました。ブラウザの設定を確認してください。");
    }
  }

  async function handleToggleEventStatus(event: AdminEvent) {
    if (!db) {
      return;
    }

    setError("");
    setNotice("");
    setUpdatingEventId(event.id);

    try {
      const nextStatus = getNextEventStatus(event.status);
      await updateEventStatus({
        db,
        eventId: event.id,
        status: nextStatus
      });
      setNotice(`イベントを${getEventStatusLabel(nextStatus)}に変更しました。`);
    } catch {
      setError("イベントステータスの変更に失敗しました。");
    } finally {
      setUpdatingEventId(null);
    }
  }

  async function handleDisableEvent(event: AdminEvent) {
    if (!db) {
      return;
    }

    const label = getEventTitle(event);
    const confirmed = window.confirm(
      `「${label}」を無効化します。招待者画面には表示されなくなります。`
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setNotice("");
    setUpdatingEventId(event.id);

    try {
      await disableEvent(db, event.id);
      setNotice("イベントを無効化しました。");
    } catch {
      setError("イベントの無効化に失敗しました。");
    } finally {
      setUpdatingEventId(null);
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
            <span>{plan.name}</span>
          </p>
          <h1>{plan.name}</h1>
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

      <section className="summary-grid" aria-label="イベントサマリー">
        <SummaryCard label="有効イベント" value={String(events.length)} />
        <SummaryCard label="受付中" value={String(acceptingCount)} />
        <SummaryCard label="締切済" value={String(closedCount)} />
      </section>

      <section className="panel info-panel" aria-label="プラン情報">
        <dl className="definition-grid">
          <div>
            <dt>年月</dt>
            <dd>{formatYearMonth(plan.yearMonth)}</dd>
          </div>
          <div>
            <dt>状態</dt>
            <dd>
              <span className={plan.isActive ? "status-badge" : "status-badge muted"}>
                {plan.isActive ? "有効" : "無効"}
              </span>
            </dd>
          </div>
          <div>
            <dt>プランパスワード</dt>
            <dd>{plan.hasPassword ? "設定済み" : "未設定"}</dd>
          </div>
          <div>
            <dt>作成日時</dt>
            <dd>{formatDateTime(plan.createdAt)}</dd>
          </div>
        </dl>
        <div className="row-actions">
          <Link
            className="secondary-button button-link"
            href={`/admin/plans/${plan.id}/edit`}
          >
            プラン編集
          </Link>
          <button
            className="secondary-button"
            disabled={!plan.isActive}
            onClick={handleCopyInviteUrl}
            type="button"
          >
            配信用URLコピー
          </button>
        </div>
      </section>

      <section className="panel" aria-labelledby="events-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Events</p>
            <h2 id="events-heading">イベント一覧</h2>
          </div>
          {plan.isActive ? (
            <Link
              className="primary-button button-link"
              href={`/admin/plans/${plan.id}/events/new`}
            >
              イベント追加
            </Link>
          ) : (
            <button className="primary-button" disabled type="button">
              イベント追加
            </button>
          )}
        </div>

        {!plan.isActive ? (
          <p className="notice-message top-message">
            無効化済みプランのため、イベント追加や配信用URL共有はできません。
          </p>
        ) : null}
        {notice ? <p className="success-message top-message">{notice}</p> : null}
        {error ? <p className="error-message top-message">{error}</p> : null}

        {isEventsLoading ? (
          <p className="empty-state">イベント一覧を読み込んでいます。</p>
        ) : events.length === 0 ? (
          <div className="empty-state">
            <p>まだイベントはありません。</p>
            {plan.isActive ? (
              <Link
                className="primary-button button-link"
                href={`/admin/plans/${plan.id}/events/new`}
              >
                最初のイベントを追加
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>日程</th>
                  <th>時間帯</th>
                  <th>イベント</th>
                  <th>場所</th>
                  <th>状態</th>
                  <th>出欠</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td>{formatEventDate(event.eventDate)}</td>
                    <td>{event.timeSlot}</td>
                    <td className="strong-cell">{getEventTitle(event)}</td>
                    <td>{event.place}</td>
                    <td>
                      <span
                        className={
                          event.status === "accepting"
                            ? "status-badge"
                            : "status-badge muted"
                        }
                      >
                        {getEventStatusLabel(event.status)}
                      </span>
                    </td>
                    <td>
                      <AttendanceBadges
                        yes={eventSummaryMap[event.id]?.yes ?? 0}
                        maybe={eventSummaryMap[event.id]?.maybe ?? 0}
                        no={eventSummaryMap[event.id]?.no ?? 0}
                      />
                    </td>
                    <td>
                      <div className="row-actions">
                        <Link
                          className="secondary-button compact-button button-link"
                          href={`/admin/plans/${plan.id}/events/${event.id}`}
                        >
                          詳細
                        </Link>
                        <Link
                          className="secondary-button compact-button button-link"
                          href={`/admin/plans/${plan.id}/events/${event.id}/edit`}
                        >
                          編集
                        </Link>
                        <button
                          className="secondary-button compact-button"
                          disabled={updatingEventId === event.id}
                          onClick={() => handleToggleEventStatus(event)}
                          type="button"
                        >
                          {event.status === "accepting" ? "締切済にする" : "受付中にする"}
                        </button>
                        <button
                          className="danger-button compact-button"
                          disabled={updatingEventId === event.id}
                          onClick={() => handleDisableEvent(event)}
                          type="button"
                        >
                          無効化
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

function AttendanceBadges({
  yes,
  maybe,
  no
}: {
  yes: number;
  maybe: number;
  no: number;
}) {
  return (
    <div className="attendance-badges" aria-label="出欠人数">
      <span>○ {yes}</span>
      <span>△ {maybe}</span>
      <span>× {no}</span>
    </div>
  );
}

function getEventTitle(event: AdminEvent) {
  return event.name || "イベント名未設定";
}
