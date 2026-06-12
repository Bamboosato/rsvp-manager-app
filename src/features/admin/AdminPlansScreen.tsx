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
import { subscribeOwnerEvents, type AdminEvent } from "./events/data";
import { InviteShareDialog } from "./InviteShareDialog";
import { LineInviteDeliveryDialog } from "./LineInviteDeliveryDialog";
import {
  ensureEventAdminProfile,
  formatDateTime,
  formatYearMonth,
  subscribeOwnerPlans,
  type AdminPlan
} from "./plans/data";
import { createInviteShareUrl } from "./inviteShareLinks";
import {
  buildDefaultLineInviteGreeting,
  fetchAdminLineFriends,
  sendLineInvite,
  type AdminLineFriend
} from "./lineDelivery";

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
  const [copiedPlanId, setCopiedPlanId] = useState<string | null>(null);
  const [copyingPlanId, setCopyingPlanId] = useState<string | null>(null);
  const [inviteShareTargetPlan, setInviteShareTargetPlan] = useState<AdminPlan | null>(null);
  const [selectedInviteShareEventIds, setSelectedInviteShareEventIds] = useState<string[]>([]);
  const [inviteShareDialogError, setInviteShareDialogError] = useState("");
  const [lineDeliveryTargetPlan, setLineDeliveryTargetPlan] = useState<AdminPlan | null>(null);
  const [lineFriends, setLineFriends] = useState<AdminLineFriend[]>([]);
  const [selectedLineDeliveryEventIds, setSelectedLineDeliveryEventIds] = useState<string[]>([]);
  const [selectedLineFriendIds, setSelectedLineFriendIds] = useState<string[]>([]);
  const [lineGreeting, setLineGreeting] = useState("");
  const [lineDeliveryError, setLineDeliveryError] = useState("");
  const [lineDeliveryPlanId, setLineDeliveryPlanId] = useState<string | null>(null);
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);
  const [deleteTargetPlan, setDeleteTargetPlan] = useState<AdminPlan | null>(null);
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
      setError("幹事さん情報の初期化に失敗しました。");
    });

    return subscribeOwnerPlans({
      db,
      ownerUid: user.uid,
      onPlans: (nextPlans) => {
        setPlans(nextPlans);
        setIsLoading(false);
      },
      onError: () => {
        setError("マイプランの取得に失敗しました。");
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
  const activeEventTotal = activePlans.reduce(
    (total, plan) => total + (activeEventCounts[plan.id] ?? 0),
    0
  );

  function handleOpenInviteShareDialog(plan: AdminPlan) {
    setError("");
    setNotice("");
    setInviteShareDialogError("");

    const shareableEvents = getShareableEvents(plan.id, events);
    setSelectedInviteShareEventIds(shareableEvents.map((event) => event.id));
    setInviteShareTargetPlan(plan);
  }

  async function handleOpenLineDeliveryDialog(plan: AdminPlan) {
    setError("");
    setNotice("");
    setLineDeliveryError("");

    if (!user) {
      setError("ログイン状態を確認できません。再度ログインしてください。");
      return;
    }

    const shareableEvents = getShareableEvents(plan.id, events);
    setSelectedLineDeliveryEventIds(shareableEvents.map((event) => event.id));
    setSelectedLineFriendIds([]);
    setLineGreeting(buildDefaultLineInviteGreeting(plan.name));
    setLineDeliveryTargetPlan(null);
    setLineDeliveryPlanId(plan.id);

    try {
      const friends = await fetchAdminLineFriends(user);
      setLineFriends(friends);
      setSelectedLineFriendIds(
        friends
          .filter((friend) => friend.isDeliverable && friend.isFriend)
          .map((friend) => friend.id)
      );
      setLineDeliveryTargetPlan(plan);
    } catch (lineError) {
      const message =
        lineError instanceof Error
          ? lineError.message
          : "LINE友だち一覧の取得に失敗しました。";
      setError(message);
      setLineDeliveryError(message);
    } finally {
      setLineDeliveryPlanId(null);
    }
  }

  async function handleCopyInviteUrl() {
    setInviteShareDialogError("");

    if (!user || !inviteShareTargetPlan) {
      setInviteShareDialogError("ログイン状態を確認できません。再度ログインしてください。");
      return;
    }

    const targetPlan = inviteShareTargetPlan;
    const shareableEvents = getShareableEvents(targetPlan.id, events);
    const shareableEventIdSet = new Set(shareableEvents.map((event) => event.id));
    const selectedEventIds = selectedInviteShareEventIds.filter((eventId) =>
      shareableEventIdSet.has(eventId)
    );

    if (selectedEventIds.length === 0) {
      setInviteShareDialogError("配信用URLに含めるイベントを選択してください。");
      return;
    }

    setCopyingPlanId(targetPlan.id);

    try {
      const inviteUrl = await createInviteShareUrl({
        user,
        plan: targetPlan,
        eventIds: selectedEventIds
      });
      await copyPlainTextToClipboard(inviteUrl);
      setInviteShareTargetPlan(null);
      showCopyFeedback(targetPlan.id);
    } catch (copyError) {
      setInviteShareDialogError(
        copyError instanceof Error
          ? copyError.message
          : "URLコピーに失敗しました。ブラウザの設定を確認してください。"
      );
    } finally {
      setCopyingPlanId(null);
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
    setLineDeliveryError("");

    if (!user || !lineDeliveryTargetPlan) {
      setLineDeliveryError("ログイン状態を確認できません。再度ログインしてください。");
      return;
    }

    const targetPlan = lineDeliveryTargetPlan;
    const shareableEvents = getShareableEvents(targetPlan.id, events);
    const shareableEventIdSet = new Set(shareableEvents.map((event) => event.id));
    const selectedEventIds = selectedLineDeliveryEventIds.filter((eventId) =>
      shareableEventIdSet.has(eventId)
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
      setLineDeliveryError("配信用URLに含めるイベントを選択してください。");
      return;
    }

    if (lineFriendIds.length === 0) {
      setLineDeliveryError("LINE配信先を選択してください。");
      return;
    }

    setLineDeliveryPlanId(targetPlan.id);

    try {
      const result = await sendLineInvite({
        user,
        planId: targetPlan.id,
        eventIds: selectedEventIds,
        lineFriendIds,
        greeting: lineGreeting
      });
      setLineDeliveryTargetPlan(null);
      setNotice(
        result.failedCount > 0
          ? `LINE配信を実行しました。成功 ${result.sentCount}件 / 失敗 ${result.failedCount}件`
          : `LINE配信を実行しました。送信先 ${result.sentCount}件`
      );
    } catch (lineError) {
      setLineDeliveryError(
        lineError instanceof Error ? lineError.message : "LINE配信に失敗しました。"
      );
    } finally {
      setLineDeliveryPlanId(null);
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

  function requestDisablePlan(plan: AdminPlan) {
    setError("");
    setNotice("");
    setDeleteTargetPlan(plan);
  }

  async function handleDisablePlan() {
    if (!deleteTargetPlan || !user) {
      return;
    }

    setDeletingPlanId(deleteTargetPlan.id);

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/admin/plans/${deleteTargetPlan.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${idToken}`
        }
      });
      const result = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        setError(result?.message ?? "プランの削除に失敗しました。");
        setDeleteTargetPlan(null);
        return;
      }

      setNotice("プランを削除しました。");
      setDeleteTargetPlan(null);
    } catch {
      setError("プランの削除に失敗しました。");
    } finally {
      setDeletingPlanId(null);
    }
  }

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div className="page-heading">
          <div className="title-row">
            <Link
              aria-label="マイプランへ移動"
              className="header-mark brand-mark"
              data-tooltip="マイプランへ移動"
              href="/admin/plans"
            >
              <span>RSVP</span>
              <span>HUB</span>
            </Link>
            <h1>マイプラン</h1>
          </div>
        </div>
        <AdminAccountMenu user={user} onSignOut={signOut} />
      </header>

      <section className="panel" aria-label="マイプラン">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Plans</p>
            <AdminSectionMetrics
              metrics={[
                { label: "プラン数", value: activePlans.length },
                { label: "イベント数", value: activeEventTotal }
              ]}
            />
          </div>
          {canCreatePlan ? (
            <Link
              className="primary-button button-link"
              data-tooltip="新しいプランを作成"
              href="/admin/plans/new"
            >
              プラン追加
            </Link>
          ) : (
            <button
              className="primary-button"
              data-tooltip="プランは最大3件まで作成できます"
              disabled
              type="button"
            >
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
          <p className="loading-inline" role="status" aria-live="polite">
            読み込み中...
          </p>
        ) : activePlans.length === 0 ? (
          <div className="empty-state">
            <p>まだプランがありません。</p>
            <Link
              className="primary-button button-link"
              data-tooltip="最初のプランを作成"
              href="/admin/plans/new"
            >
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
                  <th className="action-column three-actions">操作</th>
                </tr>
              </thead>
              <tbody>
                {activePlans.map((plan) => {
                  const isCopyingInviteUrl = copyingPlanId === plan.id;

                  return (
                    <tr key={plan.id}>
                      <td className="strong-cell">{plan.name}</td>
                      <td>{formatYearMonth(plan.yearMonth)}</td>
                      <td>{activeEventCounts[plan.id] ?? 0}</td>
                      <td>{plan.hasPassword ? "設定済み" : "未設定"}</td>
                      <td>
                        <div className="copy-feedback-wrap">
                          <button
                            className="secondary-button compact-button invite-share-trigger-button"
                            data-tooltip="招待者へ送る配信用URLを作成"
                            disabled={isCopyingInviteUrl}
                            onClick={() => handleOpenInviteShareDialog(plan)}
                            type="button"
                          >
                            {isCopyingInviteUrl ? "作成中" : "コピー"}
                          </button>
                          {copiedPlanId === plan.id ? (
                            <span className="copy-feedback" role="status">
                              コピーしました
                            </span>
                          ) : null}
                        </div>
                        <button
                          className="secondary-button compact-button line-delivery-trigger-button"
                          data-tooltip="配信用URLをLINE友だちへ送信"
                          disabled={lineDeliveryPlanId === plan.id}
                          onClick={() => handleOpenLineDeliveryDialog(plan)}
                          type="button"
                        >
                          {lineDeliveryPlanId === plan.id ? "読込中" : "LINE配信"}
                        </button>
                      </td>
                      <td>{formatDateTime(plan.createdAt)}</td>
                      <td className="action-column three-actions">
                        <div className="row-actions">
                          <Link
                            className="secondary-button compact-button button-link"
                            data-tooltip="このプランのイベント一覧を表示"
                            href={`/admin/plans/${plan.id}`}
                          >
                            イベント
                          </Link>
                          <Link
                            className="secondary-button compact-button button-link"
                            data-tooltip="プラン名・年月・アクセスコードを編集"
                            href={`/admin/plans/${plan.id}/edit`}
                          >
                            編集
                          </Link>
                          <button
                            className="danger-button compact-button"
                            data-tooltip="このプランを削除"
                            disabled={deletingPlanId === plan.id}
                            onClick={() => requestDisablePlan(plan)}
                            type="button"
                          >
                            {deletingPlanId === plan.id ? "処理中" : "削除"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {inviteShareTargetPlan ? (
        <InviteShareDialog
          error={inviteShareDialogError}
          events={getShareableEvents(inviteShareTargetPlan.id, events)}
          isProcessing={copyingPlanId === inviteShareTargetPlan.id}
          onCancel={() => setInviteShareTargetPlan(null)}
          onCopy={handleCopyInviteUrl}
          onToggleEvent={toggleInviteShareEvent}
          selectedEventIds={selectedInviteShareEventIds}
        />
      ) : null}

      {lineDeliveryTargetPlan ? (
        <LineInviteDeliveryDialog
          error={lineDeliveryError}
          events={getShareableEvents(lineDeliveryTargetPlan.id, events)}
          friends={lineFriends}
          greeting={lineGreeting}
          isProcessing={lineDeliveryPlanId === lineDeliveryTargetPlan.id}
          onCancel={() => setLineDeliveryTargetPlan(null)}
          onGreetingChange={setLineGreeting}
          onSend={handleSendLineInvite}
          onToggleEvent={toggleLineDeliveryEvent}
          onToggleFriend={toggleLineFriend}
          selectedEventIds={selectedLineDeliveryEventIds}
          selectedFriendIds={selectedLineFriendIds}
        />
      ) : null}

      {deleteTargetPlan ? (
        <ConfirmDialog
          confirmLabel="削除する"
          isProcessing={deletingPlanId === deleteTargetPlan.id}
          message={`プラン「${deleteTargetPlan.name}」を削除します。招待URLからもアクセスできなくなります。`}
          onCancel={() => setDeleteTargetPlan(null)}
          onConfirm={handleDisablePlan}
          title="プラン削除の確認"
          variant="danger"
        />
      ) : null}
    </main>
  );
}

function getShareableEvents(planId: string, events: AdminEvent[]) {
  return events
    .filter(
      (event) =>
        event.planId === planId && event.isActive && event.status === "accepting"
    )
    .sort(compareEventsForInviteShare);
}

function compareEventsForInviteShare(first: AdminEvent, second: AdminEvent) {
  const dateDiff = first.eventDate.localeCompare(second.eventDate);

  if (dateDiff !== 0) {
    return dateDiff;
  }

  const timeDiff = getTimeSlotOrder(first.timeSlot) - getTimeSlotOrder(second.timeSlot);

  if (timeDiff !== 0) {
    return timeDiff;
  }

  return first.sortOrder - second.sortOrder;
}

function getTimeSlotOrder(timeSlot: AdminEvent["timeSlot"]) {
  return timeSlot === "AM" ? 0 : 1;
}
