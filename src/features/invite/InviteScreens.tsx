"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

type AttendanceStatus = "yes" | "maybe" | "no";

const attendanceChoices: Array<{
  status: AttendanceStatus;
  iconSrc: string;
  label: string;
}> = [
  { status: "yes", iconSrc: "/icons/attendance-yes.svg", label: "参加" },
  { status: "maybe", iconSrc: "/icons/attendance-maybe.svg", label: "未定" },
  { status: "no", iconSrc: "/icons/attendance-no.svg", label: "不参加" }
];

type PublicPlan = {
  name: string;
  yearMonth: string;
  hasPassword: boolean;
};

type InviteEvent = {
  id: string;
  eventDate: string;
  timeSlot: "AM" | "PM";
  name: string;
  place: string;
  status: "accepting" | "closed";
  response: {
    attendanceStatus: AttendanceStatus;
    comment: string;
    answeredAt: string | null;
  } | null;
};

type InviteResponseDetail = {
  plan: PublicPlan;
  guest: {
    nickname: string;
  };
  events: InviteEvent[];
};

type AnswerState = Record<
  string,
  {
    attendanceStatus: AttendanceStatus | "";
    comment: string;
  }
>;

export function InviteStartScreen({ publicToken }: { publicToken: string }) {
  const router = useRouter();
  const [plan, setPlan] = useState<PublicPlan | null>(null);
  const [accessCode, setAccessCode] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadPublicPlan({
      publicToken,
      onPlan: setPlan,
      onError: setError,
      onFinally: () => setIsLoading(false)
    });
  }, [publicToken]);

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!/^\d{6,12}$/.test(accessCode.trim())) {
      setError("アクセスコードは6〜12桁の数字で入力してください。");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/invite/${publicToken}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessCode: accessCode.trim() })
      });
      const result = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        setError(result?.message ?? "アクセスコードが正しくありません。");
        return;
      }

      router.push(`/invite/${publicToken}/entry`);
    } catch {
      setError("通信に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <InviteMessage title="読み込んでいます" eyebrow="Loading" />;
  }

  if (!plan) {
    return (
      <InviteMessage
        title="このURLは利用できません"
        eyebrow="Error"
        message={error || "URLが正しくないか、利用できません。"}
      />
    );
  }

  return (
    <main className="invite-shell">
      <section className="panel invite-panel">
        <p className="eyebrow">RSVP</p>
        <h1>{plan.name}</h1>
        <p className="muted-text">{formatYearMonth(plan.yearMonth)}</p>

        {plan.hasPassword ? (
          <form className="form-stack top-message" onSubmit={handlePasswordSubmit}>
            <label className="field">
              <span>アクセスコード</span>
              <input
                autoComplete="current-password"
                disabled={isSubmitting}
                inputMode="numeric"
                maxLength={12}
                onChange={(event) => setAccessCode(event.target.value)}
                pattern="[0-9]*"
                required
                type="text"
                value={accessCode}
              />
              <span className="field-hint">6〜12桁の数字</span>
            </label>
            {error ? <p className="error-message">{error}</p> : null}
            <button className="primary-button full-width" disabled={isSubmitting} type="submit">
              {isSubmitting ? "確認中" : "次へ"}
            </button>
          </form>
        ) : (
          <Link
            className="primary-button button-link full-width top-message"
            href={`/invite/${publicToken}/entry`}
          >
            出欠入力へ進む
          </Link>
        )}
      </section>
    </main>
  );
}

export function InviteEntryScreen({ publicToken }: { publicToken: string }) {
  const router = useRouter();
  const [plan, setPlan] = useState<PublicPlan | null>(null);
  const [nickname, setNickname] = useState("");
  const [pin, setPin] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadPublicPlan({
      publicToken,
      onPlan: setPlan,
      onError: setError,
      onFinally: () => setIsLoading(false)
    });
  }, [publicToken]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/invite/${publicToken}/entry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname, pin })
      });
      const result = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        setError(result?.message ?? "入力内容を確認してください。");
        return;
      }

      router.push(`/invite/${publicToken}/responses`);
    } catch {
      setError("通信に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <InviteMessage title="読み込んでいます" eyebrow="Loading" />;
  }

  if (!plan) {
    return (
      <InviteMessage
        title="このURLは利用できません"
        eyebrow="Error"
        message={error || "URLが正しくないか、利用できません。"}
      />
    );
  }

  return (
    <main className="invite-shell">
      <section className="panel invite-panel">
        <p className="eyebrow">Entry</p>
        <h1>{plan.name}</h1>
        <p className="muted-text">{formatYearMonth(plan.yearMonth)}</p>

        <form className="form-stack top-message" onSubmit={handleSubmit}>
          <label className="field">
            <span>ニックネーム</span>
            <input
              autoComplete="name"
              disabled={isSubmitting}
              maxLength={40}
              onChange={(event) => setNickname(event.target.value)}
              required
              type="text"
              value={nickname}
            />
          </label>
          <label className="field">
            <span>4桁のPIN</span>
            <input
              disabled={isSubmitting}
              inputMode="numeric"
              maxLength={4}
              onChange={(event) => setPin(event.target.value)}
              pattern="\d{4}"
              required
              type="text"
              value={pin}
            />
          </label>
          {error ? <p className="error-message">{error}</p> : null}
          <button className="primary-button full-width" disabled={isSubmitting} type="submit">
            {isSubmitting ? "確認中" : "次へ"}
          </button>
        </form>
      </section>
    </main>
  );
}

export function InviteResponsesScreen({ publicToken }: { publicToken: string }) {
  const router = useRouter();
  const [detail, setDetail] = useState<InviteResponseDetail | null>(null);
  const [answers, setAnswers] = useState<AnswerState>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isActive = true;

    async function loadResponseDetail() {
      try {
        const response = await fetch(`/api/invite/${publicToken}/responses`);
        const result = (await response.json().catch(() => null)) as
          | (InviteResponseDetail & { message?: string })
          | null;

        if (!isActive) {
          return;
        }

        if (!response.ok || !result) {
          setError(result?.message ?? "出欠入力を表示できません。");
          setDetail(null);
          return;
        }

        setDetail(result);
        setAnswers(
          result.events.reduce<AnswerState>((nextAnswers, event) => {
            nextAnswers[event.id] = {
              attendanceStatus: event.response?.attendanceStatus ?? "",
              comment: event.response?.comment ?? ""
            };
            return nextAnswers;
          }, {})
        );
      } catch {
        if (isActive) {
          setError("通信に失敗しました。時間をおいて再度お試しください。");
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    loadResponseDetail();

    return () => {
      isActive = false;
    };
  }, [publicToken]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!detail) {
      return;
    }

    const acceptingEvents = detail.events.filter((inviteEvent) => inviteEvent.status === "accepting");

    if (acceptingEvents.length === 0) {
      setError("受付中のイベントがありません。");
      return;
    }

    const missingAnswer = acceptingEvents.find(
      (inviteEvent) => !answers[inviteEvent.id]?.attendanceStatus
    );

    if (missingAnswer) {
      setError("受付中イベントの出欠を選択してください。");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/invite/${publicToken}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responses: acceptingEvents.map((inviteEvent) => ({
            eventId: inviteEvent.id,
            attendanceStatus: answers[inviteEvent.id].attendanceStatus,
            comment: answers[inviteEvent.id].comment
          }))
        })
      });
      const result = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        setError(result?.message ?? "保存に失敗しました。時間をおいて再度お試しください。");
        return;
      }

      router.push(`/invite/${publicToken}/complete`);
    } catch {
      setError("保存に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <InviteMessage title="読み込んでいます" eyebrow="Loading" />;
  }

  if (!detail) {
    return (
      <InviteMessage
        title="出欠入力を表示できません"
        eyebrow="Error"
        message={error}
        actionHref={`/invite/${publicToken}/entry`}
        actionLabel="ニックネームとPINを入力する"
      />
    );
  }

  return (
    <main className="invite-shell">
      <header className="invite-header">
        <p className="eyebrow">Responses</p>
        <h1>{detail.plan.name}</h1>
        <p className="muted-text">
          {detail.guest.nickname} / {formatYearMonth(detail.plan.yearMonth)}
        </p>
      </header>

      <form className="invite-event-list" onSubmit={handleSubmit}>
        {detail.events.length === 0 ? (
          <section className="panel invite-panel">
            <p className="empty-state">現在入力できるイベントはありません。</p>
          </section>
        ) : (
          detail.events.map((inviteEvent) => (
            <InviteEventCard
              answer={answers[inviteEvent.id] ?? { attendanceStatus: "", comment: "" }}
              disabled={isSubmitting}
              inviteEvent={inviteEvent}
              key={inviteEvent.id}
              onChange={(nextAnswer) =>
                setAnswers((currentAnswers) => ({
                  ...currentAnswers,
                  [inviteEvent.id]: nextAnswer
                }))
              }
            />
          ))
        )}

        {error ? <p className="error-message">{error}</p> : null}

        <div className="invite-sticky-actions">
          <Link className="secondary-button button-link" href={`/invite/${publicToken}/entry`}>
            戻る
          </Link>
          <button
            className="primary-button"
            disabled={isSubmitting || detail.events.every((event) => event.status === "closed")}
            type="submit"
          >
            {isSubmitting ? "保存中" : "保存"}
          </button>
        </div>
      </form>
    </main>
  );
}

export function InviteCompleteScreen({ publicToken }: { publicToken: string }) {
  const [detail, setDetail] = useState<InviteResponseDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadCompleteDetail() {
      try {
        const response = await fetch(`/api/invite/${publicToken}/responses`);
        const result = (await response.json().catch(() => null)) as
          | (InviteResponseDetail & { message?: string })
          | null;

        if (!response.ok || !result) {
          setError(result?.message ?? "入力内容を表示できません。");
          return;
        }

        setDetail(result);
      } catch {
        setError("通信に失敗しました。時間をおいて再度お試しください。");
      } finally {
        setIsLoading(false);
      }
    }

    loadCompleteDetail();
  }, [publicToken]);

  if (isLoading) {
    return <InviteMessage title="読み込んでいます" eyebrow="Loading" />;
  }

  if (!detail) {
    return (
      <InviteMessage
        title="入力内容を表示できません"
        eyebrow="Error"
        message={error}
        actionHref={`/invite/${publicToken}/entry`}
        actionLabel="ニックネームとPINを入力する"
      />
    );
  }

  return (
    <main className="invite-shell">
      <section className="panel invite-panel">
        <p className="eyebrow">Complete</p>
        <h1>出欠入力が完了しました。</h1>
        <div className="notice-message top-message">
          <p>
            再編集する場合、初回入力時と同じニックネーム、PINで共有URLから再度アクセスしてください。
          </p>
          <p>
            締切後に出欠を変更する場合、画面から変更できませんので管理者に直接ご連絡ください。
          </p>
        </div>
      </section>

      <section className="panel invite-panel">
        <h2>入力内容</h2>
        <div className="complete-response-list">
          {detail.events.map((inviteEvent) => (
            <article className="complete-response-row" key={inviteEvent.id}>
              <div>
                <p className="event-date">
                  {formatEventDate(inviteEvent.eventDate)} {inviteEvent.timeSlot}
                </p>
                <h3>{inviteEvent.name || inviteEvent.place}</h3>
                <p className="muted-text">{inviteEvent.place}</p>
              </div>
              <div className="complete-response-value">
                <strong>{getAttendanceLabel(inviteEvent.response?.attendanceStatus)}</strong>
                <span>{inviteEvent.response?.comment || "-"}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function InviteEventCard({
  inviteEvent,
  answer,
  disabled,
  onChange
}: {
  inviteEvent: InviteEvent;
  answer: {
    attendanceStatus: AttendanceStatus | "";
    comment: string;
  };
  disabled: boolean;
  onChange: (answer: { attendanceStatus: AttendanceStatus | ""; comment: string }) => void;
}) {
  const isClosed = inviteEvent.status === "closed";

  return (
    <article className="panel invite-event-card">
      <div className="invite-event-heading">
        <div>
          <p className="event-date">
            {formatEventDate(inviteEvent.eventDate)} {inviteEvent.timeSlot}
          </p>
          <h2>{inviteEvent.name || inviteEvent.place}</h2>
          <p className="muted-text">{inviteEvent.place}</p>
        </div>
        <span className={isClosed ? "status-badge muted" : "status-badge"}>
          {isClosed ? "締切済" : "受付中"}
        </span>
      </div>

      {isClosed && !inviteEvent.response ? (
        <p className="notice-message">締切済のため入力できません。</p>
      ) : null}

      <div className="invite-choice-row" aria-label="出欠">
        {attendanceChoices.map((choice) => (
          <button
            aria-label={choice.label}
            aria-pressed={answer.attendanceStatus === choice.status}
            className={
              answer.attendanceStatus === choice.status
                ? "choice-button selected"
                : "choice-button"
            }
            disabled={disabled || isClosed}
            key={choice.status}
            onClick={() =>
              onChange({
                ...answer,
                attendanceStatus: choice.status
              })
            }
            type="button"
          >
            <span className="choice-button-icon" aria-hidden="true">
              <Image alt="" height={32} src={choice.iconSrc} unoptimized width={32} />
            </span>
          </button>
        ))}
      </div>

      <label className="field">
        <span>コメント</span>
        <textarea
          disabled={disabled || isClosed}
          maxLength={500}
          onChange={(event) =>
            onChange({
              ...answer,
              comment: event.target.value
            })
          }
          rows={3}
          value={answer.comment}
        />
      </label>
    </article>
  );
}

function InviteMessage({
  eyebrow,
  title,
  message,
  actionHref,
  actionLabel
}: {
  eyebrow: string;
  title: string;
  message?: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <main className="invite-shell">
      <section className="panel invite-panel">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {message ? <p className="error-message top-message">{message}</p> : null}
        {actionHref && actionLabel ? (
          <Link className="primary-button button-link full-width top-message" href={actionHref}>
            {actionLabel}
          </Link>
        ) : null}
      </section>
    </main>
  );
}

async function loadPublicPlan({
  publicToken,
  onPlan,
  onError,
  onFinally
}: {
  publicToken: string;
  onPlan: (plan: PublicPlan | null) => void;
  onError: (message: string) => void;
  onFinally: () => void;
}) {
  try {
    const response = await fetch(`/api/invite/${publicToken}`);
    const result = (await response.json().catch(() => null)) as
      | { plan?: PublicPlan; message?: string }
      | null;

    if (!response.ok || !result?.plan) {
      onError(result?.message ?? "URLが正しくないか、利用できません。");
      onPlan(null);
      return;
    }

    onPlan(result.plan);
  } catch {
    onError("通信に失敗しました。時間をおいて再度お試しください。");
  } finally {
    onFinally();
  }
}

function formatYearMonth(yearMonth: string) {
  const [year, month] = yearMonth.split("-");

  if (!year || !month) {
    return yearMonth;
  }

  return `${year}年${month}月`;
}

function formatEventDate(eventDate: string) {
  const [year, month, day] = eventDate.split("-");

  if (!year || !month || !day) {
    return eventDate;
  }

  return `${year}/${month}/${day}`;
}

function getAttendanceLabel(status: AttendanceStatus | undefined) {
  if (status === "yes") {
    return "○";
  }

  if (status === "maybe") {
    return "△";
  }

  if (status === "no") {
    return "×";
  }

  return "-";
}
