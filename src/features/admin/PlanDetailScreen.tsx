"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { ConfirmDialog } from "@/features/ui/ConfirmDialog";
import { getFirebaseClientFirestore } from "@/lib/firebase/client";
import { AdminAccountMenu } from "./AdminAccountMenu";
import { AdminSectionMetrics } from "./AdminSectionMetrics";
import { copyPlainTextToClipboard } from "./clipboard";
import {
  disableEvent,
  formatEventDate,
  getEventStatusLabel,
  subscribePlanEvents,
  updateEventStatus,
  type AdminEvent,
  type EventStatus
} from "./events/data";
import { InviteShareDialog } from "./InviteShareDialog";
import { LineInviteDeliveryDialog } from "./LineInviteDeliveryDialog";
import { createInviteShareUrl } from "./inviteShareLinks";
import {
  fetchAdminLineFriends,
  sendLineInvite,
  type AdminLineFriend
} from "./lineDelivery";
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
  const [isInviteShareDialogOpen, setIsInviteShareDialogOpen] = useState(false);
  const [selectedInviteShareEventIds, setSelectedInviteShareEventIds] = useState<string[]>([]);
  const [isCreatingInviteShareUrl, setIsCreatingInviteShareUrl] = useState(false);
  const [inviteShareDialogError, setInviteShareDialogError] = useState("");
  const [isLineDeliveryDialogOpen, setIsLineDeliveryDialogOpen] = useState(false);
  const [lineFriends, setLineFriends] = useState<AdminLineFriend[]>([]);
  const [selectedLineDeliveryEventIds, setSelectedLineDeliveryEventIds] = useState<string[]>([]);
  const [selectedLineFriendIds, setSelectedLineFriendIds] = useState<string[]>([]);
  const [lineGreeting, setLineGreeting] = useState("");
  const [isSendingLineInvite, setIsSendingLineInvite] = useState(false);
  const [lineDeliveryDialogError, setLineDeliveryDialogError] = useState("");
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

  const acceptingEvents = useMemo(
    () => events.filter((event) => event.status === "accepting"),
    [events]
  );
  const acceptingCount = acceptingEvents.length;
  const closedCount = events.filter((event) => event.status === "closed").length;
  const eventSummaryMap = useMemo(
    () => buildEventSummaryMap(responses),
    [responses]
  );

  function handleOpenInviteShareDialog() {
    setError("");
    setNotice("");
    setInviteShareDialogError("");

    if (!plan?.isActive) {
      setError("無効化済みプランのURLは共有できません。");
      return;
    }

    setSelectedInviteShareEventIds(acceptingEvents.map((event) => event.id));
    setIsInviteShareDialogOpen(true);
  }

  async function handleOpenLineDeliveryDialog() {
    setError("");
    setNotice("");
    setLineDeliveryDialogError("");

    if (!plan?.isActive) {
      setError("無効化済みプランのURLは共有できません。");
      return;
    }

    if (!user) {
      setError("ログイン状態を確認できません。再度ログインしてください。");
      return;
    }

    setSelectedLineDeliveryEventIds(acceptingEvents.map((event) => event.id));
    setSelectedLineFriendIds([]);
    setLineGreeting("");
    setIsLineDeliveryDialogOpen(false);
    setIsSendingLineInvite(true);

    try {
      const friends = await fetchAdminLineFriends(user);
      setLineFriends(friends);
      setSelectedLineFriendIds(
        friends
          .filter((friend) => friend.isDeliverable && friend.isFriend)
          .map((friend) => friend.id)
      );
      setIsLineDeliveryDialogOpen(true);
    } catch (lineError) {
      const message =
        lineError instanceof Error
          ? lineError.message
          : "LINE友だち一覧の取得に失敗しました。";
      setError(message);
      setLineDeliveryDialogError(message);
    } finally {
      setIsSendingLineInvite(false);
    }
  }

  async function handleCopyInviteUrl() {
    setInviteShareDialogError("");

    if (!plan || !user) {
      setInviteShareDialogError("プラン情報を確認できません。");
      return;
    }

    const acceptingEventIdSet = new Set(acceptingEvents.map((event) => event.id));
    const selectedEventIds = selectedInviteShareEventIds.filter((eventId) =>
      acceptingEventIdSet.has(eventId)
    );

    if (selectedEventIds.length === 0) {
      setInviteShareDialogError("配信用URLに含めるイベントを選択してください。");
      return;
    }

    setIsCreatingInviteShareUrl(true);

    try {
      const inviteUrl = await createInviteShareUrl({
        user,
        plan,
        eventIds: selectedEventIds
      });
      await copyPlainTextToClipboard(inviteUrl);
      setIsInviteShareDialogOpen(false);
      showCopyFeedback();
    } catch (copyError) {
      setInviteShareDialogError(
        copyError instanceof Error
          ? copyError.message
          : "URLコピーに失敗しました。ブラウザの設定を確認してください。"
      );
    } finally {
      setIsCreatingInviteShareUrl(false);
    }
  }

  function toggleInviteShareEvent(eventId: string, checked: boolean) {
    setSelectedInviteShareEventIds((currentEventIds) => {
      if (checked) {
        return currentEventIds.includes(eventId)
          ? currentEventIds
          : [...currentEventIds, eventId];
      }

      return currentEventIds.filter((currentEventId) => currentEventId !== eventId);
    });
  }

  function toggleLineDeliveryEvent(eventId: string, checked: boolean) {
    setSelectedLineDeliveryEventIds((currentEventIds) => {
      if (checked) {
        return currentEventIds.includes(eventId)
          ? currentEventIds
          : [...currentEventIds, eventId];
      }

      return currentEventIds.filter((currentEventId) => currentEventId !== eventId);
    });
  }

  function toggleLineFriend(friendId: string, checked: boolean) {
    setSelectedLineFriendIds((currentFriendIds) => {
      if (checked) {
        return currentFriendIds.includes(friendId)
          ? currentFriendIds
          : [...currentFriendIds, friendId];
      }

      return currentFriendIds.filter((currentFriendId) => currentFriendId !== friendId);
    });
  }

  async function handleSendLineInvite() {
    setLineDeliveryDialogError("");

    if (!plan || !user) {
      setLineDeliveryDialogError("プラン情報を確認できません。");
      return;
    }

    const acceptingEventIdSet = new Set(acceptingEvents.map((event) => event.id));
    const selectedEventIds = selectedLineDeliveryEventIds.filter((eventId) =>
      acceptingEventIdSet.has(eventId)
    );
    const deliverableFriendIdSet = new Set(
      lineFriends
        .filter((friend) => friend.isDeliverable && friend.isFriend)
        .map((friend) => friend.id)
    );
    const lineFriendIds = selectedLineFriendIds.filter((friendId) =>
      deliverableFriendIdSet.has(friendId)
    );

    if (selectedEventIds.length === 0) {
      setLineDeliveryDialogError("配信用URLに含めるイベントを選択してください。");
      return;
    }

    if (lineFriendIds.length === 0) {
      setLineDeliveryDialogError("LINE配信先を選択してください。");
      return;
    }

    setIsSendingLineInvite(true);

    try {
      const result = await sendLineInvite({
        user,
        planId: plan.id,
        eventIds: selectedEventIds,
        lineFriendIds,
        greeting: lineGreeting
      });
      setIsLineDeliveryDialogOpen(false);
      setNotice(
        result.failedCount > 0
          ? `LINE配信を実行しました。成功 ${result.sentCount}件 / 失敗 ${result.failedCount}件`
          : `LINE配信を実行しました。送信先 ${result.sentCount}件`
      );
    } catch (lineError) {
      setLineDeliveryDialogError(
        lineError instanceof Error ? lineError.message : "LINE配信に失敗しました。"
      );
    } finally {
      setIsSendingLineInvite(false);
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
            プランが存在しないか、ログイン中の幹事さんでは閲覧できません。
          </p>
          <Link
            className="secondary-button button-link top-message"
            data-tooltip="マイプランへ戻る"
            href="/admin/plans"
          >
            マイプランへ戻る
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="top-bar sticky-top-bar">
        <div className="page-heading">
          <div className="title-row">
            <Link className="back-link" data-tooltip="マイプランへ戻る" href="/admin/plans">
              <span>←</span>
              <span>戻る</span>
            </Link>
            <div className="title-stack">
              <span className="title-label">プラン</span>
              <h1>{plan.name}</h1>
            </div>
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
          <div className="copy-feedback-wrap">
            <button
              className="secondary-button invite-share-trigger-button"
              data-tooltip="招待者へ送る配信用URLを作成"
              disabled={!plan.isActive}
              onClick={handleOpenInviteShareDialog}
              type="button"
            >
              配信用URL
            </button>
            {isInviteUrlCopied ? (
              <span className="copy-feedback" role="status">
                コピーしました
              </span>
            ) : null}
          </div>
          <button
            className="secondary-button invite-share-trigger-button"
            data-tooltip="配信用URLをLINE友だちへ送信"
            disabled={!plan.isActive || isSendingLineInvite}
            onClick={handleOpenLineDeliveryDialog}
            type="button"
          >
            {isSendingLineInvite ? "読込中" : "LINE配信"}
          </button>
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
                  <th>詳細</th>
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
                    <td>{event.timeDetail.trim() || "---"}</td>
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

      {isInviteShareDialogOpen ? (
        <InviteShareDialog
          error={inviteShareDialogError}
          events={acceptingEvents}
          isProcessing={isCreatingInviteShareUrl}
          onCancel={() => setIsInviteShareDialogOpen(false)}
          onCopy={handleCopyInviteUrl}
          onToggleEvent={toggleInviteShareEvent}
          selectedEventIds={selectedInviteShareEventIds}
        />
      ) : null}

      {isLineDeliveryDialogOpen ? (
        <LineInviteDeliveryDialog
          error={lineDeliveryDialogError}
          events={acceptingEvents}
          friends={lineFriends}
          greeting={lineGreeting}
          isProcessing={isSendingLineInvite}
          onCancel={() => setIsLineDeliveryDialogOpen(false)}
          onGreetingChange={setLineGreeting}
          onSend={handleSendLineInvite}
          onToggleEvent={toggleLineDeliveryEvent}
          onToggleFriend={toggleLineFriend}
          selectedEventIds={selectedLineDeliveryEventIds}
          selectedFriendIds={selectedLineFriendIds}
        />
      ) : null}

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

function buildStatusChangeMessage(event: AdminEvent, nextStatus: EventStatus) {
  const label = getEventTitle(event);

  if (nextStatus === "closed") {
    return `イベント「${label}」を締切済にします。招待者はこのイベントの出欠を変更できなくなります。`;
  }

  return `イベント「${label}」を受付中に戻します。招待者がこのイベントの出欠を変更できるようになります。`;
}
