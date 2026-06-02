"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { formatEventDate, getEventStatusLabel } from "./events/data";
import { formatYearMonth } from "./plans/data";

type AttendanceStatus = "yes" | "maybe" | "no";

type EventDetail = {
  event: {
    id: string;
    eventId: string;
    planId: string;
    name: string;
    eventDate: string;
    timeSlot: string;
    place: string;
    status: "accepting" | "closed";
    isActive: boolean;
  };
  plan: {
    id: string;
    name: string;
    yearMonth: string;
  } | null;
  summary: {
    yes: number;
    maybe: number;
    no: number;
  };
  responses: EventResponse[];
};

type EventResponse = {
  id: string;
  responseId: string;
  guestId: string;
  nickname: string;
  attendanceStatus: AttendanceStatus;
  comment: string;
  answeredAt: string | null;
  lastUpdatedBy: "admin" | "guest";
};

type EditingState = {
  response: EventResponse;
  attendanceStatus: AttendanceStatus;
  comment: string;
} | null;

type PinResetState = {
  response: EventResponse;
  newPin: string;
  confirmPin: string;
} | null;

export function EventDetailScreen({ eventId }: { eventId: string }) {
  return (
    <ProtectedRoute>
      <EventDetail eventId={eventId} />
    </ProtectedRoute>
  );
}

function EventDetail({ eventId }: { eventId: string }) {
  const { signOut, user } = useAuth();
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<EditingState>(null);
  const [pinReset, setPinReset] = useState<PinResetState>(null);

  const loadDetail = useCallback(async () => {
    if (!user) {
      return;
    }

    setError("");

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/admin/events/${eventId}/responses`, {
        headers: {
          Authorization: `Bearer ${idToken}`
        }
      });
      const result = (await response.json().catch(() => null)) as
        | (EventDetail & { message?: string })
        | null;

      if (!response.ok || !result) {
        setError(result?.message ?? "イベント詳細の取得に失敗しました。");
        setDetail(null);
        return;
      }

      setDetail(result);
    } catch {
      setError("通信に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setIsLoading(false);
    }
  }, [eventId, user]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadDetail();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadDetail]);

  async function handleAddResponse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user) {
      setError("ログイン状態を確認できません。");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const payload = {
      nickname: String(formData.get("nickname") ?? ""),
      pin: String(formData.get("pin") ?? ""),
      attendanceStatus: String(formData.get("attendanceStatus") ?? ""),
      comment: String(formData.get("comment") ?? "")
    };

    setIsSubmitting(true);
    setError("");
    setNotice("");

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/admin/events/${eventId}/responses`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const result = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;

      if (!response.ok) {
        setError(result?.message ?? "回答の追加に失敗しました。");
        return;
      }

      event.currentTarget.reset();
      setNotice("回答を代理追加しました。");
      await loadDetail();
    } catch {
      setError("通信に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleEditResponse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user || !editing) {
      return;
    }

    setIsSubmitting(true);
    setError("");
    setNotice("");

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/admin/responses/${editing.response.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          attendanceStatus: editing.attendanceStatus,
          comment: editing.comment
        })
      });
      const result = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;

      if (!response.ok) {
        setError(result?.message ?? "回答の修正に失敗しました。");
        return;
      }

      setEditing(null);
      setNotice("回答を修正しました。");
      await loadDetail();
    } catch {
      setError("通信に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePinReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user || !pinReset) {
      return;
    }

    if (pinReset.newPin !== pinReset.confirmPin) {
      setError("新PINと確認用PINが一致しません。");
      return;
    }

    setIsSubmitting(true);
    setError("");
    setNotice("");

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/admin/guests/${pinReset.response.guestId}/pin-reset`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          newPin: pinReset.newPin
        })
      });
      const result = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;

      if (!response.ok) {
        setError(result?.message ?? "PINリセットに失敗しました。");
        return;
      }

      setPinReset(null);
      setNotice("PINをリセットしました。新しいPINを招待者へ連絡してください。");
      await loadDetail();
    } catch {
      setError("通信に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <main className="app-shell">
        <section className="panel narrow-panel">
          <p className="eyebrow">Loading</p>
          <h1>イベント詳細を読み込んでいます</h1>
        </section>
      </main>
    );
  }

  if (!detail) {
    return (
      <main className="app-shell">
        <section className="panel narrow-panel">
          <p className="eyebrow">Not Found</p>
          <h1>イベントを表示できません</h1>
          {error ? <p className="error-message top-message">{error}</p> : null}
          <Link className="secondary-button button-link top-message" href="/admin/plans">
            プラン一覧へ戻る
          </Link>
        </section>
      </main>
    );
  }

  const eventTitle = detail.event.name || "イベント名未設定";
  const planHref = `/admin/plans/${detail.event.planId}`;

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div>
          <p className="breadcrumb">
            <Link href="/admin/plans">プラン一覧</Link>
            <span> / </span>
            <Link href={planHref}>{detail.plan?.name ?? "プラン詳細"}</Link>
            <span> / {eventTitle}</span>
          </p>
          <h1>{eventTitle}</h1>
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

      <section className="summary-grid" aria-label="出欠サマリー">
        <SummaryCard label="参加" value={String(detail.summary.yes)} />
        <SummaryCard label="未定" value={String(detail.summary.maybe)} />
        <SummaryCard label="不参加" value={String(detail.summary.no)} />
      </section>

      <section className="panel info-panel" aria-label="イベント情報">
        <dl className="definition-grid">
          <div>
            <dt>プラン</dt>
            <dd>
              {detail.plan?.name ?? "-"}
              {detail.plan ? ` / ${formatYearMonth(detail.plan.yearMonth)}` : ""}
            </dd>
          </div>
          <div>
            <dt>日程</dt>
            <dd>{formatEventDate(detail.event.eventDate)}</dd>
          </div>
          <div>
            <dt>時間帯</dt>
            <dd>{detail.event.timeSlot}</dd>
          </div>
          <div>
            <dt>状態</dt>
            <dd>
              <span
                className={
                  detail.event.status === "accepting"
                    ? "status-badge"
                    : "status-badge muted"
                }
              >
                {getEventStatusLabel(detail.event.status)}
              </span>
            </dd>
          </div>
          <div>
            <dt>場所</dt>
            <dd>{detail.event.place}</dd>
          </div>
        </dl>
      </section>

      {notice ? <p className="success-message top-message">{notice}</p> : null}
      {error ? <p className="error-message top-message">{error}</p> : null}

      <section className="panel" aria-labelledby="responses-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Responses</p>
            <h2 id="responses-heading">出欠内訳</h2>
          </div>
        </div>

        {detail.responses.length === 0 ? (
          <p className="empty-state">まだ回答はありません。</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ニックネーム</th>
                  <th>出欠</th>
                  <th>コメント</th>
                  <th>回答日時</th>
                  <th>最終更新者</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {detail.responses.map((response) => (
                  <tr key={response.id}>
                    <td className="strong-cell">{response.nickname}</td>
                    <td>{getAttendanceLabel(response.attendanceStatus)}</td>
                    <td className="comment-cell">{response.comment || "-"}</td>
                    <td>{formatDateTime(response.answeredAt)}</td>
                    <td>{response.lastUpdatedBy === "admin" ? "管理者(Admin)" : "招待者(Guest)"}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="secondary-button compact-button"
                          onClick={() =>
                            setEditing({
                              response,
                              attendanceStatus: response.attendanceStatus,
                              comment: response.comment
                            })
                          }
                          type="button"
                        >
                          修正
                        </button>
                        <button
                          className="secondary-button compact-button"
                          onClick={() =>
                            setPinReset({
                              response,
                              newPin: "",
                              confirmPin: ""
                            })
                          }
                          type="button"
                        >
                          PINリセット
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

      <section className="panel" aria-labelledby="add-response-heading">
        <div className="section-heading stacked-heading">
          <div>
            <p className="eyebrow">Admin Entry</p>
            <h2 id="add-response-heading">回答代理追加</h2>
          </div>
        </div>
        <form className="form-stack" onSubmit={handleAddResponse}>
          <div className="inline-form-grid">
            <label className="field">
              <span>ニックネーム</span>
              <input disabled={isSubmitting} maxLength={40} name="nickname" required type="text" />
            </label>
            <label className="field">
              <span>PIN</span>
              <input
                disabled={isSubmitting}
                inputMode="numeric"
                maxLength={4}
                name="pin"
                pattern="\d{4}"
                required
                type="text"
              />
            </label>
            <label className="field">
              <span>出欠</span>
              <select defaultValue="yes" disabled={isSubmitting} name="attendanceStatus" required>
                <option value="yes">○ 参加</option>
                <option value="maybe">△ 未定</option>
                <option value="no">× 不参加</option>
              </select>
            </label>
          </div>
          <label className="field">
            <span>コメント</span>
            <textarea disabled={isSubmitting} maxLength={500} name="comment" rows={3} />
          </label>
          <div className="form-actions">
            <button className="primary-button" disabled={isSubmitting} type="submit">
              {isSubmitting ? "保存中" : "追加"}
            </button>
          </div>
        </form>
      </section>

      {editing ? (
        <section className="panel action-panel" aria-labelledby="edit-response-heading">
          <div className="section-heading stacked-heading">
            <div>
              <p className="eyebrow">Edit</p>
              <h2 id="edit-response-heading">回答修正: {editing.response.nickname}</h2>
            </div>
          </div>
          <form className="form-stack" onSubmit={handleEditResponse}>
            <p className="notice-message">
              この回答を管理者として修正します。回答日時も更新されます。
            </p>
            <label className="field">
              <span>出欠</span>
              <select
                disabled={isSubmitting}
                onChange={(event) =>
                  setEditing({
                    ...editing,
                    attendanceStatus: event.target.value as AttendanceStatus
                  })
                }
                value={editing.attendanceStatus}
              >
                <option value="yes">○ 参加</option>
                <option value="maybe">△ 未定</option>
                <option value="no">× 不参加</option>
              </select>
            </label>
            <label className="field">
              <span>コメント</span>
              <textarea
                disabled={isSubmitting}
                maxLength={500}
                onChange={(event) =>
                  setEditing({
                    ...editing,
                    comment: event.target.value
                  })
                }
                rows={3}
                value={editing.comment}
              />
            </label>
            <div className="form-actions">
              <button className="primary-button" disabled={isSubmitting} type="submit">
                保存
              </button>
              <button
                className="secondary-button"
                disabled={isSubmitting}
                onClick={() => setEditing(null)}
                type="button"
              >
                キャンセル
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {pinReset ? (
        <section className="panel action-panel" aria-labelledby="pin-reset-heading">
          <div className="section-heading stacked-heading">
            <div>
              <p className="eyebrow">PIN Reset</p>
              <h2 id="pin-reset-heading">PINリセット: {pinReset.response.nickname}</h2>
            </div>
          </div>
          <form className="form-stack" onSubmit={handlePinReset}>
            <p className="notice-message">
              PINリセットでは既存の出欠回答は変更されません。新しいPINはLINE等で招待者へ連絡してください。
            </p>
            <div className="inline-form-grid two-columns">
              <label className="field">
                <span>新PIN</span>
                <input
                  disabled={isSubmitting}
                  inputMode="numeric"
                  maxLength={4}
                  onChange={(event) =>
                    setPinReset({
                      ...pinReset,
                      newPin: event.target.value
                    })
                  }
                  pattern="\d{4}"
                  required
                  type="text"
                  value={pinReset.newPin}
                />
              </label>
              <label className="field">
                <span>新PIN確認</span>
                <input
                  disabled={isSubmitting}
                  inputMode="numeric"
                  maxLength={4}
                  onChange={(event) =>
                    setPinReset({
                      ...pinReset,
                      confirmPin: event.target.value
                    })
                  }
                  pattern="\d{4}"
                  required
                  type="text"
                  value={pinReset.confirmPin}
                />
              </label>
            </div>
            <div className="form-actions">
              <button className="primary-button" disabled={isSubmitting} type="submit">
                リセット
              </button>
              <button
                className="secondary-button"
                disabled={isSubmitting}
                onClick={() => setPinReset(null)}
                type="button"
              >
                キャンセル
              </button>
            </div>
          </form>
        </section>
      ) : null}
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

function getAttendanceLabel(status: AttendanceStatus) {
  if (status === "yes") {
    return "○";
  }

  if (status === "maybe") {
    return "△";
  }

  return "×";
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
