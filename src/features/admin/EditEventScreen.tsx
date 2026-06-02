"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { getFirebaseClientFirestore } from "@/lib/firebase/client";
import {
  formatEventDate,
  getEventStatusLabel,
  subscribeOwnerEvent,
  updateEventDetails,
  type AdminEvent,
  type EventStatus,
  type EventTimeSlot
} from "./events/data";
import { formatYearMonth, subscribeOwnerPlan, type AdminPlan } from "./plans/data";

export function EditEventScreen({
  planId,
  eventId
}: {
  planId: string;
  eventId: string;
}) {
  return (
    <ProtectedRoute>
      <EditEventForm planId={planId} eventId={eventId} />
    </ProtectedRoute>
  );
}

function EditEventForm({
  planId,
  eventId
}: {
  planId: string;
  eventId: string;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const db = useMemo(() => getFirebaseClientFirestore(), []);
  const [plan, setPlan] = useState<AdminPlan | null>(null);
  const [eventDetail, setEventDetail] = useState<AdminEvent | null>(null);
  const [name, setName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [timeSlot, setTimeSlot] = useState<EventTimeSlot>("AM");
  const [place, setPlace] = useState("");
  const [status, setStatus] = useState<EventStatus>("accepting");
  const [isPlanLoading, setIsPlanLoading] = useState(true);
  const [isEventLoading, setIsEventLoading] = useState(true);
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
        setIsPlanLoading(false);
      },
      onError: () => {
        setError("プラン情報の取得に失敗しました。");
        setIsPlanLoading(false);
      }
    });
  }, [db, planId, user]);

  useEffect(() => {
    if (!db || !user) {
      return undefined;
    }

    return subscribeOwnerEvent({
      db,
      ownerUid: user.uid,
      eventId,
      onEvent: (nextEvent) => {
        setEventDetail(nextEvent);
        setName(nextEvent?.name ?? "");
        setEventDate(nextEvent?.eventDate ?? "");
        setTimeSlot(nextEvent?.timeSlot ?? "AM");
        setPlace(nextEvent?.place ?? "");
        setStatus(nextEvent?.status ?? "accepting");
        setIsEventLoading(false);
      },
      onError: () => {
        setError("イベント情報の取得に失敗しました。");
        setIsEventLoading(false);
      }
    });
  }, [db, eventId, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!db || !plan || !eventDetail) {
      setError("イベント情報を確認できません。");
      return;
    }

    if (!plan.isActive || !eventDetail.isActive || eventDetail.planId !== plan.id) {
      setError("このイベントは編集できません。");
      return;
    }

    const validation = validateEventInput({
      name,
      eventDate,
      timeSlot,
      place,
      status
    });

    if (!validation.ok) {
      setError(validation.message);
      return;
    }

    setIsSubmitting(true);

    try {
      await updateEventDetails(db, {
        eventId: eventDetail.id,
        name,
        eventDate,
        timeSlot,
        place,
        status
      });
      router.push(`/admin/plans/${plan.id}/events/${eventDetail.id}`);
    } catch {
      setError("イベントの更新に失敗しました。");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isPlanLoading || isEventLoading) {
    return (
      <main className="app-shell">
        <section className="panel narrow-panel">
          <p className="eyebrow">Loading</p>
          <h1>イベント情報を読み込んでいます</h1>
        </section>
      </main>
    );
  }

  if (!plan || !eventDetail || eventDetail.planId !== plan.id) {
    return (
      <main className="app-shell">
        <section className="panel narrow-panel">
          <p className="eyebrow">Not Found</p>
          <h1>イベントを表示できません</h1>
          <p className="muted-text">
            イベントが存在しないか、ログイン中のイベント管理者では閲覧できません。
          </p>
          <Link className="secondary-button button-link top-message" href={`/admin/plans/${planId}`}>
            イベント一覧へ戻る
          </Link>
        </section>
      </main>
    );
  }

  const canEdit = plan.isActive && eventDetail.isActive;

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div>
          <p className="breadcrumb">
            <Link href="/admin/plans">プラン一覧</Link>
            <span> / </span>
            <Link href={`/admin/plans/${plan.id}`}>{plan.name}</Link>
            <span> / </span>
            <Link href={`/admin/plans/${plan.id}/events/${eventDetail.id}`}>
              {getEventTitle(eventDetail)}
            </Link>
            <span> / イベント編集</span>
          </p>
          <h1>イベント編集</h1>
          <p className="muted-text">
            {formatYearMonth(plan.yearMonth)} / {formatEventDate(eventDetail.eventDate)}{" "}
            {eventDetail.timeSlot}
          </p>
        </div>
        <Link
          className="secondary-button button-link"
          href={`/admin/plans/${plan.id}/events/${eventDetail.id}`}
        >
          イベント詳細へ戻る
        </Link>
      </header>

      <section className="panel narrow-panel" aria-labelledby="edit-event-heading">
        <div className="section-heading stacked-heading">
          <div>
            <p className="eyebrow">Edit Event</p>
            <h2 id="edit-event-heading">イベント情報</h2>
          </div>
        </div>

        {!canEdit ? (
          <p className="notice-message">無効化済みのため、このイベントは編集できません。</p>
        ) : null}

        <form className="form-stack" onSubmit={handleSubmit}>
          <label className="field">
            <span>イベント名（任意）</span>
            <input
              disabled={isSubmitting || !canEdit}
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
              type="text"
              value={name}
            />
          </label>

          <label className="field">
            <span>日程</span>
            <input
              disabled={isSubmitting || !canEdit}
              onChange={(event) => setEventDate(event.target.value)}
              required
              type="date"
              value={eventDate}
            />
          </label>

          <label className="field">
            <span>時間帯</span>
            <select
              disabled={isSubmitting || !canEdit}
              onChange={(event) => setTimeSlot(event.target.value as EventTimeSlot)}
              required
              value={timeSlot}
            >
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
          </label>

          <label className="field">
            <span>場所</span>
            <input
              disabled={isSubmitting || !canEdit}
              maxLength={120}
              onChange={(event) => setPlace(event.target.value)}
              required
              type="text"
              value={place}
            />
          </label>

          <label className="field">
            <span>ステータス</span>
            <select
              disabled={isSubmitting || !canEdit}
              onChange={(event) => setStatus(event.target.value as EventStatus)}
              required
              value={status}
            >
              <option value="accepting">{getEventStatusLabel("accepting")}</option>
              <option value="closed">{getEventStatusLabel("closed")}</option>
            </select>
          </label>

          {error ? <p className="error-message">{error}</p> : null}

          <div className="form-actions">
            <button className="primary-button" disabled={isSubmitting || !canEdit} type="submit">
              {isSubmitting ? "保存中" : "保存"}
            </button>
            <Link
              className="secondary-button button-link"
              href={`/admin/plans/${plan.id}/events/${eventDetail.id}`}
            >
              キャンセル
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}

function validateEventInput(input: {
  name: string;
  eventDate: string;
  timeSlot: string;
  place: string;
  status: string;
}): { ok: true } | { ok: false; message: string } {
  if (input.name.trim().length > 80) {
    return { ok: false, message: "イベント名は80文字以内で入力してください。" };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.eventDate)) {
    return { ok: false, message: "日程を選択してください。" };
  }

  if (input.timeSlot !== "AM" && input.timeSlot !== "PM") {
    return { ok: false, message: "時間帯を選択してください。" };
  }

  if (!input.place.trim()) {
    return { ok: false, message: "場所を入力してください。" };
  }

  if (input.place.trim().length > 120) {
    return { ok: false, message: "場所は120文字以内で入力してください。" };
  }

  if (input.status !== "accepting" && input.status !== "closed") {
    return { ok: false, message: "ステータスを選択してください。" };
  }

  return { ok: true };
}

function getEventTitle(event: AdminEvent) {
  return event.name || "イベント名未設定";
}
