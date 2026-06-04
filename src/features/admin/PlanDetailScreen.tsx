"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { ConfirmDialog } from "@/features/ui/ConfirmDialog";
import { getFirebaseClientFirestore } from "@/lib/firebase/client";
import { AdminAccountMenu } from "./AdminAccountMenu";
import { AdminSectionMetrics } from "./AdminSectionMetrics";
import {
  disableEvent,
  formatEventDate,
  getEventStatusLabel,
  subscribePlanEvents,
  updateEventStatus,
  type AdminEvent,
  type EventStatus
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
  const [isInviteUrlCopied, setIsInviteUrlCopied] = useState(false);
  const [statusFeedbackEventId, setStatusFeedbackEventId] = useState<string | null>(null);
  const [updatingEventId, setUpdatingEventId] = useState<string | null>(null);
  const [statusChangeTarget, setStatusChangeTarget] = useState<{
    event: AdminEvent;
    nextStatus: EventStatus;
  } | null>(null);
  const [deleteTargetEvent, setDeleteTargetEvent] = useState<AdminEvent | null>(null);
  const copyFeedbackTimerRef = useRef<number | null>(null);
  const statusFeedbackTimerRef = useRef<number | null>(null);

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
    return () => {
      if (copyFeedbackTimerRef.current) {
        window.clearTimeout(copyFeedbackTimerRef.current);
      }
      if (statusFeedbackTimerRef.current) {
        window.clearTimeout(statusFeedbackTimerRef.current);
      }
    };
  }, []);

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
      await copyInviteLinkToClipboard(plan);
      showCopyFeedback();
    } catch {
      setError("URLコピーに失敗しました。ブラウザの設定を確認してください。");
    }
  }

  function showCopyFeedback() {
    setIsInviteUrlCopied(true);

    if (copyFeedbackTimerRef.current) {
      window.clearTimeout(copyFeedbackTimerRef.current);
    }

    copyFeedbackTimerRef.current = window.setTimeout(() => {
      setIsInviteUrlCopied(false);
      copyFeedbackTimerRef.current = null;
    }, 3000);
  }

  function requestChangeEventStatus(event: AdminEvent, nextStatus: EventStatus) {
    if (event.status === nextStatus) {
      return;
    }

    setError("");
    setNotice("");
    setStatusChangeTarget({ event, nextStatus });
  }

  async function handleChangeEventStatus() {
    if (!db || !statusChangeTarget) {
      return;
    }

    const { event, nextStatus } = statusChangeTarget;

    setError("");
    setNotice("");
    setUpdatingEventId(event.id);

    try {
      await updateEventStatus({
        db,
        eventId: event.id,
        status: nextStatus
      });
      showStatusFeedback(event.id);
      setStatusChangeTarget(null);
    } catch {
      setError("イベントステータスの変更に失敗しました。");
      setStatusChangeTarget(null);
    } finally {
      setUpdatingEventId(null);
    }
  }

  function showStatusFeedback(eventId: string) {
    setStatusFeedbackEventId(eventId);

    if (statusFeedbackTimerRef.current) {
      window.clearTimeout(statusFeedbackTimerRef.current);
    }

    statusFeedbackTimerRef.current = window.setTimeout(() => {
      setStatusFeedbackEventId(null);
      statusFeedbackTimerRef.current = null;
    }, 3000);
  }

  function requestDeleteEvent(event: AdminEvent) {
    setError("");
    setNotice("");
    setDeleteTargetEvent(event);
  }

  async function handleDeleteEvent() {
    if (!db || !deleteTargetEvent) {
      return;
    }

    setUpdatingEventId(deleteTargetEvent.id);

    try {
      await disableEvent(db, deleteTargetEvent.id);
      setNotice("イベントを削除しました。");
      setDeleteTargetEvent(null);
    } catch {
      setError("イベントの削除に失敗しました。");
      setDeleteTargetEvent(null);
    } finally {
      setUpdatingEventId(null);
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
            <h1>{plan.name}</h1>
          </div>
        </div>
        <AdminAccountMenu user={user} onSignOut={signOut} />
      </header>

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
            <dt>アクセスコード</dt>
            <dd>{plan.hasPassword ? "設定済み" : "未設定"}</dd>
          </div>
          <div>
            <dt>作成日時</dt>
            <dd>{formatDateTime(plan.createdAt)}</dd>
          </div>
        </dl>
        <div className="row-actions">
          {plan.isActive ? (
            <Link
              className="secondary-button button-link"
              data-tooltip="出欠回答ページを別タブで開く"
              href={`/invite/${plan.publicToken}`}
              rel="noreferrer"
              target="_blank"
            >
              URLを開く
            </Link>
          ) : (
            <button
              className="secondary-button"
              data-tooltip="無効なプランのURLは開けません"
              disabled
              type="button"
            >
              URLを開く
            </button>
          )}
          <div className="copy-feedback-wrap">
            <button
              className="secondary-button"
              data-tooltip="招待者へ送るプラン名とURLをコピー"
              disabled={!plan.isActive}
              onClick={handleCopyInviteUrl}
              type="button"
            >
              URLコピー
            </button>
            {isInviteUrlCopied ? (
              <span className="copy-feedback" role="status">
                コピーしました
              </span>
            ) : null}
          </div>
        </div>
      </section>

      <section className="panel" aria-label="イベント一覧">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Events</p>
            <AdminSectionMetrics
              metrics={[
                { label: "イベント数", value: events.length },
                { label: "受付中", value: acceptingCount },
                { label: "締切済", value: closedCount }
              ]}
            />
          </div>
          {plan.isActive ? (
            <Link
              className="primary-button button-link"
              data-tooltip="このプランにイベントを追加"
              href={`/admin/plans/${plan.id}/events/new`}
            >
              イベント追加
            </Link>
          ) : (
            <button
              className="primary-button"
              data-tooltip="無効なプランにはイベントを追加できません"
              disabled
              type="button"
            >
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
          <p className="loading-inline" role="status" aria-live="polite">
            読み込み中...
          </p>
        ) : events.length === 0 ? (
          <div className="empty-state">
            <p>まだイベントはありません。</p>
            {plan.isActive ? (
              <Link
                className="primary-button button-link"
                data-tooltip="最初のイベントを作成"
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
                  <th>イベント</th>
                  <th>日程</th>
                  <th>時間帯</th>
                  <th>場所</th>
                  <th className="status-column">状態</th>
                  <th className="attendance-column">出欠</th>
                  <th className="action-column three-actions">操作</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td className="strong-cell">{getEventTitle(event)}</td>
                    <td>{formatEventDate(event.eventDate)}</td>
                    <td>{event.timeSlot}</td>
                    <td>{event.place}</td>
                    <td className="status-column">
                      <div className="status-feedback-wrap">
                        <div
                          className="status-segment"
                          aria-label={`イベント状態: ${getEventStatusLabel(event.status)}`}
                        >
                          <button
                            aria-pressed={event.status === "accepting"}
                            className={
                              event.status === "accepting"
                                ? "status-segment-button active"
                                : "status-segment-button"
                            }
                            data-tooltip="受付中に変更"
                            disabled={updatingEventId === event.id}
                            onClick={() => requestChangeEventStatus(event, "accepting")}
                            type="button"
                          >
                            受付中
                          </button>
                          <button
                            aria-pressed={event.status === "closed"}
                            className={
                              event.status === "closed"
                                ? "status-segment-button active muted"
                                : "status-segment-button"
                            }
                            data-tooltip="締切済に変更"
                            disabled={updatingEventId === event.id}
                            onClick={() => requestChangeEventStatus(event, "closed")}
                            type="button"
                          >
                            締切済
                          </button>
                        </div>
                        {statusFeedbackEventId === event.id ? (
                          <span className="copy-feedback" role="status">
                            変更しました
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="attendance-column">
                      <AttendanceBadges
                        yes={eventSummaryMap[event.id]?.yes ?? 0}
                        maybe={eventSummaryMap[event.id]?.maybe ?? 0}
                        no={eventSummaryMap[event.id]?.no ?? 0}
                      />
                    </td>
                    <td className="action-column three-actions">
                      <div className="row-actions">
                        <Link
                          className="secondary-button compact-button button-link"
                          data-tooltip="このイベントの出欠内訳を表示"
                          href={`/admin/plans/${plan.id}/events/${event.id}`}
                        >
                          出欠内訳
                        </Link>
                        <Link
                          className="secondary-button compact-button button-link"
                          data-tooltip="イベント情報を編集"
                          href={`/admin/plans/${plan.id}/events/${event.id}/edit`}
                        >
                          編集
                        </Link>
                        <button
                          className="danger-button compact-button"
                          data-tooltip="このイベントを削除"
                          disabled={updatingEventId === event.id}
                          onClick={() => requestDeleteEvent(event)}
                          type="button"
                        >
                          削除
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

      {statusChangeTarget ? (
        <ConfirmDialog
          confirmLabel={
            statusChangeTarget.nextStatus === "closed" ? "締切済にする" : "受付中に戻す"
          }
          isProcessing={updatingEventId === statusChangeTarget.event.id}
          message={buildStatusChangeMessage(statusChangeTarget.event, statusChangeTarget.nextStatus)}
          onCancel={() => setStatusChangeTarget(null)}
          onConfirm={handleChangeEventStatus}
          title="ステータス変更の確認"
        />
      ) : null}

      {deleteTargetEvent ? (
        <ConfirmDialog
          confirmLabel="削除する"
          isProcessing={updatingEventId === deleteTargetEvent.id}
          message={`イベント「${getEventTitle(deleteTargetEvent)}」を削除します。招待者画面には表示されなくなります。`}
          onCancel={() => setDeleteTargetEvent(null)}
          onConfirm={handleDeleteEvent}
          title="イベント削除の確認"
          variant="danger"
        />
      ) : null}
    </main>
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

async function copyInviteLinkToClipboard(plan: AdminPlan) {
  const inviteUrl = `${window.location.origin}/invite/${plan.publicToken}`;
  const plainText = `${plan.name}\n${inviteUrl}`;

  if (typeof ClipboardItem !== "undefined" && typeof navigator.clipboard.write === "function") {
    const htmlText = `<a href="${escapeHtml(inviteUrl)}">${escapeHtml(plan.name)}</a>`;

    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([htmlText], { type: "text/html" }),
          "text/plain": new Blob([plainText], { type: "text/plain" })
        })
      ]);
      return;
    } catch {
      // Fall back to plain text for browsers or paste targets that reject rich clipboard data.
    }
  }

  await navigator.clipboard.writeText(plainText);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };

    return entities[character] ?? character;
  });
}

function buildStatusChangeMessage(event: AdminEvent, nextStatus: EventStatus) {
  const label = getEventTitle(event);

  if (nextStatus === "closed") {
    return `イベント「${label}」を締切済にします。招待者はこのイベントの出欠を変更できなくなります。`;
  }

  return `イベント「${label}」を受付中に戻します。招待者がこのイベントの出欠を変更できるようになります。`;
}
