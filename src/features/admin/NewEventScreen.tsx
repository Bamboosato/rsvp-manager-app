"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { getFirebaseClientFirestore } from "@/lib/firebase/client";
import { createEvent, type EventTimeSlot } from "./events/data";
import { formatYearMonth, subscribeOwnerPlan, type AdminPlan } from "./plans/data";

export function NewEventScreen({ planId }: { planId: string }) {
  return (
    <ProtectedRoute>
      <NewEventForm planId={planId} />
    </ProtectedRoute>
  );
}

function NewEventForm({ planId }: { planId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const db = useMemo(() => getFirebaseClientFirestore(), []);
  const [plan, setPlan] = useState<AdminPlan | null>(null);
  const [isPlanLoading, setIsPlanLoading] = useState(true);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!db || !user || !plan) {
      setError("プラン情報を確認できません。");
      return;
    }

    if (!plan.isActive) {
      setError("無効化済みプランにはイベントを追加できません。");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    const eventDate = String(formData.get("eventDate") ?? "").trim();
    const timeSlotValue = String(formData.get("timeSlot") ?? "");
    const place = String(formData.get("place") ?? "").trim();
    const validation = validateEventInput({
      name,
      eventDate,
      timeSlot: timeSlotValue,
      place
    });

    if (!validation.ok) {
      setError(validation.message);
      return;
    }

    setIsSubmitting(true);

    try {
      await createEvent(db, {
        planId: plan.id,
        ownerUid: user.uid,
        name,
        eventDate,
        timeSlot: validation.timeSlot,
        place
      });
      router.push(`/admin/plans/${plan.id}`);
    } catch {
      setError("イベントの作成に失敗しました。");
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
            <span> / イベント追加</span>
          </p>
          <h1>イベント追加</h1>
          <p className="muted-text">
            {plan.name} / {formatYearMonth(plan.yearMonth)}
          </p>
        </div>
        <Link className="secondary-button button-link" href={`/admin/plans/${plan.id}`}>
          イベント一覧へ戻る
        </Link>
      </header>

      <section className="panel narrow-panel" aria-labelledby="new-event-heading">
        <div className="section-heading stacked-heading">
          <div>
            <p className="eyebrow">New Event</p>
            <h2 id="new-event-heading">イベント情報</h2>
          </div>
        </div>

        {!plan.isActive ? (
          <p className="notice-message">
            無効化済みプランのため、イベントを追加できません。
          </p>
        ) : null}

        <form className="form-stack" onSubmit={handleSubmit}>
          <label className="field">
            <span>イベント名（任意）</span>
            <input
              defaultValue={plan.name}
              disabled={isSubmitting || !plan.isActive}
              maxLength={80}
              name="name"
              type="text"
            />
          </label>

          <label className="field">
            <span>日程</span>
            <input disabled={isSubmitting || !plan.isActive} name="eventDate" required type="date" />
          </label>

          <label className="field">
            <span>時間帯</span>
            <select
              defaultValue="AM"
              disabled={isSubmitting || !plan.isActive}
              name="timeSlot"
              required
            >
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
          </label>

          <label className="field">
            <span>場所</span>
            <input
              disabled={isSubmitting || !plan.isActive}
              maxLength={120}
              name="place"
              required
              type="text"
            />
          </label>

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

function validateEventInput(input: {
  name: string;
  eventDate: string;
  timeSlot: string;
  place: string;
}):
  | { ok: true; timeSlot: EventTimeSlot }
  | { ok: false; message: string } {
  if (input.name.length > 80) {
    return { ok: false, message: "イベント名は80文字以内で入力してください。" };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.eventDate)) {
    return { ok: false, message: "日程を選択してください。" };
  }

  if (input.timeSlot !== "AM" && input.timeSlot !== "PM") {
    return { ok: false, message: "時間帯を選択してください。" };
  }

  if (!input.place) {
    return { ok: false, message: "場所を入力してください。" };
  }

  if (input.place.length > 120) {
    return { ok: false, message: "場所は120文字以内で入力してください。" };
  }

  return { ok: true, timeSlot: input.timeSlot };
}
