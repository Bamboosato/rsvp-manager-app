"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { AdminAccountMenu } from "./AdminAccountMenu";
import { AdminSectionMetrics } from "./AdminSectionMetrics";
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
  const [isAddResponseOpen, setIsAddResponseOpen] = useState(false);
  const [editing, setEditing] = useState<EditingState>(null);
  const [pinReset, setPinReset] = useState<PinResetState>(null);
  const isAddResponseSubmittingRef = useRef(false);

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
    const form = event.currentTarget;

    if (isAddResponseSubmittingRef.current) {
      return;
    }

    if (!user) {
      setError("ログイン状態を確認できません。");
      return;
    }

    isAddResponseSubmittingRef.current = true;

    const formData = new FormData(form);
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
        if (response.status === 409) {
          await loadDetail();
        }

        setError(result?.message ?? "回答の追加に失敗しました。");
        return;
      }

      form.reset();
      setIsAddResponseOpen(false);
      setNotice("回答を代理追加しました。");
      await loadDetail();
    } catch {
      setError("通信に失敗しました。時間をおいて再度お試しください。");
    } finally {
      isAddResponseSubmittingRef.current = false;
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
        <section className="loading-panel" role="status" aria-live="polite">
          読み込み中...
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

  const eventTitle = detail.event.name || "イベント名未設定";
  const planHref = `/admin/plans/${detail.event.planId}`;

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div className="page-heading">
          <div className="title-row">
            <Link className="back-link" data-tooltip="イベント一覧へ戻る" href={planHref}>
              <span>←</span>
              <span>戻る</span>
            </Link>
            <h1>{eventTitle}</h1>
          </div>
        </div>
        <AdminAccountMenu user={user} onSignOut={signOut} />
      </header>

      <section className="panel info-panel event-info-panel" aria-label="イベント情報">
        <dl className="definition-grid event-definition-grid">
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
            <dt>場所</dt>
            <dd>{detail.event.place}</dd>
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
        </dl>
      </section>

      {notice ? <p className="success-message top-message">{notice}</p> : null}
      {error ? <p className="error-message top-message">{error}</p> : null}

      <section className="panel" aria-label="出欠内訳">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Responses</p>
            <AdminSectionMetrics
              metrics={[
                { label: "出席", value: detail.summary.yes },
                { label: "未定", value: detail.summary.maybe },
                { label: "欠席", value: detail.summary.no }
              ]}
            />
          </div>
          <button
            className="primary-button"
            data-tooltip="幹事さんが招待者の回答を追加"
            disabled={isSubmitting}
            onClick={() => {
              setError("");
              setNotice("");
              setIsAddResponseOpen(true);
            }}
            type="button"
          >
            代理回答
          </button>
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
                  <th className="action-column two-actions">操作</th>
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
                    <td className="action-column two-actions">
                      <div className="row-actions">
                        <button
                          className="secondary-button compact-button"
                          data-tooltip="この回答を修正"
                          onClick={() => {
                            setError("");
                            setNotice("");
                            setEditing({
                              response,
                              attendanceStatus: response.attendanceStatus,
                              comment: response.comment
                            });
                          }}
                          type="button"
                        >
                          修正
                        </button>
                        <button
                          className="secondary-button compact-button"
                          data-tooltip="招待者のPINを再設定"
                          onClick={() => {
                            setError("");
                            setNotice("");
                            setPinReset({
                              response,
                              newPin: "",
                              confirmPin: ""
                            });
                          }}
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

      {isAddResponseOpen ? (
        <div className="modal-backdrop">
          <section
            aria-labelledby="add-response-heading"
            aria-modal="true"
            className="modal-panel"
            role="dialog"
          >
            <div className="section-heading stacked-heading">
              <div>
                <p className="eyebrow">Admin Entry</p>
                <h2 id="add-response-heading">代理回答</h2>
              </div>
            </div>
            <form className="form-stack" onSubmit={handleAddResponse}>
              <div className="inline-form-grid">
                <label className="field">
                  <span>ニックネーム</span>
                  <input disabled={isSubmitting} maxLength={40} name="nickname" required type="text" />
                </label>
                <label className="field">
                  <span>PIN（数字4桁）</span>
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
                    <option value="yes">○ 出席</option>
                    <option value="maybe">△ 未定</option>
                    <option value="no">× 欠席</option>
                  </select>
                </label>
              </div>
              <label className="field">
                <span>コメント</span>
                <textarea disabled={isSubmitting} maxLength={500} name="comment" rows={3} />
              </label>
              {error ? <p className="error-message">{error}</p> : null}
              <div className="form-actions">
                <button
                  className="primary-button"
                  data-tooltip="代理回答を保存"
                  disabled={isSubmitting}
                  type="submit"
                >
                  {isSubmitting ? "保存中" : "追加"}
                </button>
                <button
                  className="secondary-button"
                  data-tooltip="入力を破棄して閉じる"
                  disabled={isSubmitting}
                  onClick={() => {
                    setError("");
                    setIsAddResponseOpen(false);
                  }}
                  type="button"
                >
                  キャンセル
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {editing ? (
        <div className="modal-backdrop">
          <section
            aria-labelledby="edit-response-heading"
            aria-modal="true"
            className="modal-panel"
            role="dialog"
          >
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
                  <option value="yes">○ 出席</option>
                  <option value="maybe">△ 未定</option>
                  <option value="no">× 欠席</option>
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
              {error ? <p className="error-message">{error}</p> : null}
              <div className="form-actions">
                <button
                  className="primary-button"
                  data-tooltip="修正内容を保存"
                  disabled={isSubmitting}
                  type="submit"
                >
                  保存
                </button>
                <button
                  className="secondary-button"
                  data-tooltip="修正せずに閉じる"
                  disabled={isSubmitting}
                  onClick={() => {
                    setError("");
                    setEditing(null);
                  }}
                  type="button"
                >
                  キャンセル
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {pinReset ? (
        <div className="modal-backdrop">
          <section
            aria-labelledby="pin-reset-heading"
            aria-modal="true"
            className="modal-panel"
            role="dialog"
          >
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
                  <span>新PIN（数字4桁）</span>
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
                  <span>新PIN確認（数字4桁）</span>
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
              {error ? <p className="error-message">{error}</p> : null}
              <div className="form-actions">
                <button
                  className="primary-button"
                  data-tooltip="新しいPINにリセット"
                  disabled={isSubmitting}
                  type="submit"
                >
                  リセット
                </button>
                <button
                  className="secondary-button"
                  data-tooltip="PINを変更せずに閉じる"
                  disabled={isSubmitting}
                  onClick={() => {
                    setError("");
                    setPinReset(null);
                  }}
                  type="button"
                >
                  キャンセル
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </main>
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
