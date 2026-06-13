"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { RequiredMark, RequiredNote } from "@/features/ui/RequiredMark";

type AttendanceStatus = "yes" | "maybe" | "no";

const attendanceChoices: Array<{
  status: AttendanceStatus;
  iconSrc: string;
  label: string;
}> = [
  { status: "yes", iconSrc: "/icons/attendance-yes.svg", label: "出席" },
  { status: "maybe", iconSrc: "/icons/attendance-maybe.svg", label: "未定" },
  { status: "no", iconSrc: "/icons/attendance-no.svg", label: "欠席" }
];

type PublicPlan = {
  name: string;
  yearMonth: string;
  hasPassword: boolean;
};

type CachedInviteCredential = {
  accessCode?: string;
  nickname?: string;
  pin?: string;
  planName?: string;
  yearMonth?: string;
  updatedAt: number;
};

type CachedInviteCredentialStore = {
  byToken: Record<string, CachedInviteCredential>;
  byPlan: Record<string, CachedInviteCredential>;
};

type InviteEvent = {
  id: string;
  eventDate: string;
  timeSlot: "AM" | "PM";
  timeDetail: string;
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

const inviteCredentialStorageKey = "rsvp-hub:invite-credentials:v1";
const inviteCredentialMaxAgeMs = 1000 * 60 * 60 * 24 * 180;
const inviteCredentialMaxEntries = 20;

export function InviteStartScreen({
  inviteCode
}: {
  inviteCode: string;
}) {
  const router = useRouter();
  const [plan, setPlan] = useState<PublicPlan | null>(null);
  const [accessCode, setAccessCode] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadPublicPlan({
      inviteCode,
      onPlan: (nextPlan) => {
        setPlan(nextPlan);

        if (nextPlan?.hasPassword) {
          const cachedCredential = readCachedInviteCredential(inviteCode, nextPlan);

          if (cachedCredential?.accessCode) {
            setAccessCode((currentAccessCode) => currentAccessCode || cachedCredential.accessCode || "");
          }
        }
      },
      onError: setError,
      onFinally: () => setIsLoading(false)
    });
  }, [inviteCode]);

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!/^\d{6,12}$/.test(accessCode.trim())) {
      setError("アクセスコードは6〜12桁の数字で入力してください。");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(buildInviteApiPath(inviteCode, "password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessCode: accessCode.trim() })
      });
      const result = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        setError(result?.message ?? "アクセスコードが正しくありません。");
        return;
      }

      saveCachedInviteCredential({
        inviteCode,
        plan,
        credential: {
          accessCode: accessCode.trim()
        }
      });
      router.push(buildInvitePagePath(inviteCode, "entry"));
    } catch {
      setError("通信に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <InviteLoading />;
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
            <RequiredNote />

            <label className="field">
              <span>
                アクセスコード
                <RequiredMark />
              </span>
              <input
                autoComplete="current-password"
                disabled={isSubmitting}
                inputMode="numeric"
                maxLength={12}
                onChange={(event) => setAccessCode(event.target.value)}
                pattern="[0-9]*"
                placeholder="例）123456"
                required
                type="text"
                value={accessCode}
              />
              <span className="field-hint">6〜12桁の数字</span>
            </label>
            {error ? <p className="error-message">{error}</p> : null}
            <button
              className="primary-button full-width"
              data-tooltip="アクセスコードを確認して次へ進む"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "確認中" : "次へ"}
            </button>
          </form>
        ) : (
          <Link
            className="primary-button button-link full-width top-message"
            data-tooltip="ニックネームとPINの入力へ進む"
            href={buildInvitePagePath(inviteCode, "entry")}
          >
            出欠入力へ進む
          </Link>
        )}
      </section>
    </main>
  );
}

export function InviteEntryScreen({
  inviteCode
}: {
  inviteCode: string;
}) {
  const router = useRouter();
  const [plan, setPlan] = useState<PublicPlan | null>(null);
  const [nickname, setNickname] = useState("");
  const [pin, setPin] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadPublicPlan({
      inviteCode,
      onPlan: (nextPlan) => {
        setPlan(nextPlan);

        if (nextPlan) {
          const cachedCredential = readCachedInviteCredential(inviteCode, nextPlan);

          if (cachedCredential?.nickname) {
            setNickname((currentNickname) => currentNickname || cachedCredential.nickname || "");
          }

          if (cachedCredential?.pin) {
            setPin((currentPin) => currentPin || cachedCredential.pin || "");
          }
        }
      },
      onError: setError,
      onFinally: () => setIsLoading(false)
    });
  }, [inviteCode]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      if (plan?.hasPassword) {
        const cachedCredential = readCachedInviteCredential(inviteCode, plan);

        if (cachedCredential?.accessCode) {
          await verifyInviteAccessCode(inviteCode, cachedCredential.accessCode);
        }
      }

      const response = await fetch(buildInviteApiPath(inviteCode, "entry"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname, pin })
      });
      const result = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        setError(result?.message ?? "入力内容を確認してください。");
        return;
      }

      saveCachedInviteCredential({
        inviteCode,
        plan,
        credential: {
          nickname: nickname.trim(),
          pin: pin.trim()
        }
      });
      router.push(buildInvitePagePath(inviteCode, "responses"));
    } catch {
      setError("通信に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <InviteLoading />;
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
          <RequiredNote />

          <label className="field">
            <span>
              ニックネーム
              <RequiredMark />
            </span>
            <input
              autoComplete="name"
              disabled={isSubmitting}
              maxLength={40}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="例）富浜 太郎"
              required
              type="text"
              value={nickname}
            />
          </label>
          <label className="field">
            <span>
              PIN（数字4桁）
              <RequiredMark />
            </span>
            <input
              disabled={isSubmitting}
              inputMode="numeric"
              maxLength={4}
              onChange={(event) => setPin(event.target.value)}
              pattern="\d{4}"
              placeholder="例）1234"
              required
              type="text"
              value={pin}
            />
          </label>
          {error ? <p className="error-message">{error}</p> : null}
          <button
            className="primary-button full-width"
            data-tooltip="ニックネームとPINを確認して次へ進む"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "確認中" : "次へ"}
          </button>
        </form>
      </section>
    </main>
  );
}

export function InviteResponsesScreen({
  inviteCode
}: {
  inviteCode: string;
}) {
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
        const response = await fetch(buildInviteApiPath(inviteCode, "responses"));
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
  }, [inviteCode]);

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
      const response = await fetch(buildInviteApiPath(inviteCode, "responses"), {
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

      router.push(buildInvitePagePath(inviteCode, "complete"));
    } catch {
      setError("保存に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <InviteLoading />;
  }

  if (!detail) {
    return (
      <InviteMessage
        title="出欠入力を表示できません"
        eyebrow="Error"
        message={error}
        actionHref={buildInvitePagePath(inviteCode, "entry")}
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
          <Link
            className="secondary-button button-link"
            data-tooltip="ニックネームとPIN入力へ戻る"
            href={buildInvitePagePath(inviteCode, "entry")}
          >
            戻る
          </Link>
          <button
            className="primary-button"
            data-tooltip="選択した出欠を保存"
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

export function InviteCompleteScreen({
  inviteCode
}: {
  inviteCode: string;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<InviteResponseDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadCompleteDetail() {
      try {
        const response = await fetch(buildInviteApiPath(inviteCode, "responses"));
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
  }, [inviteCode]);

  if (isLoading) {
    return <InviteLoading />;
  }

  if (!detail) {
    return (
      <InviteMessage
        title="入力内容を表示できません"
        eyebrow="Error"
        message={error}
        actionHref={buildInvitePagePath(inviteCode, "entry")}
        actionLabel="ニックネームとPINを入力する"
      />
    );
  }

  const completeDetail = detail;

  function handleContinueEntry() {
    clearCachedInviteGuestCredential({
      inviteCode,
      plan: completeDetail.plan
    });
    router.push(buildInvitePagePath(inviteCode, "entry"));
  }

  return (
    <main className="invite-shell">
      <section className="panel invite-panel">
        <h1>出欠入力が完了しました。</h1>
        <div className="notice-message top-message">
          <p>
            再編集する場合、初回入力時と同じニックネーム、PINで共有URLから再度アクセスしてください。
          </p>
          <p>
            締切後に出欠を変更する場合、画面から変更できませんので管理者に直接ご連絡ください。
          </p>
        </div>
        <div className="invite-complete-actions">
          <button
            className="secondary-button"
            data-tooltip="別の招待者として続けて入力"
            onClick={handleContinueEntry}
            type="button"
          >
            続けて出欠入力
          </button>
        </div>
      </section>

      <section className="panel invite-panel">
        <h2>入力内容</h2>
        <div className="complete-plan-summary">
          <h1>{detail.plan.name}</h1>
          <p className="muted-text">
            {detail.guest.nickname} / {formatYearMonth(detail.plan.yearMonth)}
          </p>
        </div>
        <div className="complete-response-list">
          {detail.events.map((inviteEvent) => {
            const comment = inviteEvent.response?.comment.trim();

            return (
              <article className="complete-response-row" key={inviteEvent.id}>
                <div className="complete-response-main">
                  <h3 className="invite-event-date">
                    {formatEventDate(inviteEvent.eventDate)}{" "}
                    {formatEventTime(inviteEvent.timeSlot, inviteEvent.timeDetail)}
                  </h3>
                  <p className="invite-event-name">{inviteEvent.name || inviteEvent.place}</p>
                  {comment ? <p className="complete-response-comment">{comment}</p> : null}
                  <p className="muted-text">{inviteEvent.place}</p>
                </div>
                <div className="complete-response-status">
                  <strong>{getAttendanceLabel(inviteEvent.response?.attendanceStatus)}</strong>
                </div>
              </article>
            );
          })}
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
          <h2 className="invite-event-date">
            {formatEventDate(inviteEvent.eventDate)}{" "}
            {formatEventTime(inviteEvent.timeSlot, inviteEvent.timeDetail)}
          </h2>
          <p className="invite-event-name">{inviteEvent.name || inviteEvent.place}</p>
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
            data-tooltip={choice.label}
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
          placeholder="例）少し遅れるかもしれません"
          rows={3}
          value={answer.comment}
        />
      </label>
    </article>
  );
}

function InviteLoading() {
  return (
    <main className="invite-shell">
      <section className="loading-panel" role="status" aria-live="polite">
        読み込み中...
      </section>
    </main>
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
          <Link
            className="primary-button button-link full-width top-message"
            data-tooltip={actionLabel}
            href={actionHref}
          >
            {actionLabel}
          </Link>
        ) : null}
      </section>
    </main>
  );
}

async function loadPublicPlan({
  inviteCode,
  onPlan,
  onError,
  onFinally
}: {
  inviteCode: string;
  onPlan: (plan: PublicPlan | null) => void;
  onError: (message: string) => void;
  onFinally: () => void;
}) {
  try {
    const response = await fetch(buildInviteApiPath(inviteCode, ""));
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

async function verifyInviteAccessCode(
  inviteCode: string,
  accessCode: string
) {
  const response = await fetch(buildInviteApiPath(inviteCode, "password"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessCode })
  });

  return response.ok;
}

function buildInvitePagePath(
  inviteCode: string,
  segment: "" | "entry" | "responses" | "complete"
) {
  return segment ? `/i/${inviteCode}/${segment}` : `/i/${inviteCode}`;
}

function buildInviteApiPath(
  inviteCode: string,
  endpoint: "" | "password" | "entry" | "responses"
) {
  return endpoint ? `/api/i/${inviteCode}/${endpoint}` : `/api/i/${inviteCode}`;
}

function readCachedInviteCredential(inviteCode: string, plan: PublicPlan) {
  const store = readCachedInviteCredentialStore();
  const tokenCredential = store.byToken[inviteCode];

  if (isFreshCachedInviteCredential(tokenCredential)) {
    return tokenCredential;
  }

  const planCredential = store.byPlan[buildPlanCredentialKey(plan)];

  if (isFreshCachedInviteCredential(planCredential)) {
    return planCredential;
  }

  return null;
}

function saveCachedInviteCredential({
  inviteCode,
  plan,
  credential
}: {
  inviteCode: string;
  plan: PublicPlan | null;
  credential: Partial<Pick<CachedInviteCredential, "accessCode" | "nickname" | "pin">>;
}) {
  const store = readCachedInviteCredentialStore();
  const existingCredential =
    store.byToken[inviteCode] ??
    (plan ? store.byPlan[buildPlanCredentialKey(plan)] : undefined) ??
    {};
  const nextCredential: CachedInviteCredential = {
    ...existingCredential,
    ...credential,
    planName: plan?.name ?? existingCredential.planName,
    yearMonth: plan?.yearMonth ?? existingCredential.yearMonth,
    updatedAt: Date.now()
  };

  store.byToken[inviteCode] = nextCredential;

  if (plan) {
    store.byPlan[buildPlanCredentialKey(plan)] = nextCredential;
  }

  writeCachedInviteCredentialStore(store);
}

function clearCachedInviteGuestCredential({
  inviteCode,
  plan
}: {
  inviteCode: string;
  plan: PublicPlan;
}) {
  const store = readCachedInviteCredentialStore();
  const planKey = buildPlanCredentialKey(plan);
  const tokenCredential = store.byToken[inviteCode];
  const planCredential = store.byPlan[planKey];

  if (tokenCredential) {
    store.byToken[inviteCode] = omitGuestCredential(tokenCredential);
  }

  if (planCredential) {
    store.byPlan[planKey] = omitGuestCredential(planCredential);
  }

  writeCachedInviteCredentialStore(store);
}

function omitGuestCredential(credential: CachedInviteCredential): CachedInviteCredential {
  const nextCredential = { ...credential };
  delete nextCredential.nickname;
  delete nextCredential.pin;

  return {
    ...nextCredential,
    updatedAt: Date.now()
  };
}

function readCachedInviteCredentialStore(): CachedInviteCredentialStore {
  if (typeof window === "undefined") {
    return createEmptyCachedInviteCredentialStore();
  }

  try {
    const rawStore = window.localStorage.getItem(inviteCredentialStorageKey);

    if (!rawStore) {
      return createEmptyCachedInviteCredentialStore();
    }

    const parsedStore = JSON.parse(rawStore) as unknown;

    if (!isObjectRecord(parsedStore)) {
      return createEmptyCachedInviteCredentialStore();
    }

    return {
      byToken: readCachedInviteCredentialMap(parsedStore.byToken),
      byPlan: readCachedInviteCredentialMap(parsedStore.byPlan)
    };
  } catch {
    return createEmptyCachedInviteCredentialStore();
  }
}

function writeCachedInviteCredentialStore(store: CachedInviteCredentialStore) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      inviteCredentialStorageKey,
      JSON.stringify({
        byToken: pruneCachedInviteCredentialMap(store.byToken),
        byPlan: pruneCachedInviteCredentialMap(store.byPlan)
      })
    );
  } catch {
    // Ignore storage failures so invite entry still works in private or restricted browsers.
  }
}

function readCachedInviteCredentialMap(value: unknown) {
  if (!isObjectRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, credential]) => {
      const normalizedCredential = normalizeCachedInviteCredential(credential);

      return normalizedCredential ? [[key, normalizedCredential]] : [];
    })
  );
}

function normalizeCachedInviteCredential(value: unknown): CachedInviteCredential | null {
  if (!isObjectRecord(value) || typeof value.updatedAt !== "number") {
    return null;
  }

  return {
    accessCode: typeof value.accessCode === "string" ? value.accessCode : undefined,
    nickname: typeof value.nickname === "string" ? value.nickname : undefined,
    pin: typeof value.pin === "string" ? value.pin : undefined,
    planName: typeof value.planName === "string" ? value.planName : undefined,
    yearMonth: typeof value.yearMonth === "string" ? value.yearMonth : undefined,
    updatedAt: value.updatedAt
  };
}

function pruneCachedInviteCredentialMap(
  map: Record<string, CachedInviteCredential>
): Record<string, CachedInviteCredential> {
  return Object.fromEntries(
    Object.entries(map)
      .filter(([, credential]) => isFreshCachedInviteCredential(credential))
      .sort(([, first], [, second]) => second.updatedAt - first.updatedAt)
      .slice(0, inviteCredentialMaxEntries)
  );
}

function isFreshCachedInviteCredential(
  credential: CachedInviteCredential | undefined
): credential is CachedInviteCredential {
  return Boolean(
    credential &&
      Number.isFinite(credential.updatedAt) &&
      Date.now() - credential.updatedAt <= inviteCredentialMaxAgeMs
  );
}

function buildPlanCredentialKey(plan: PublicPlan) {
  return `${plan.name}\u001f${plan.yearMonth}`;
}

function createEmptyCachedInviteCredentialStore(): CachedInviteCredentialStore {
  return {
    byToken: {},
    byPlan: {}
  };
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

  const yearNumber = Number(year);
  const monthNumber = Number(month);
  const dayNumber = Number(day);
  const date = new Date(yearNumber, monthNumber - 1, dayNumber);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== yearNumber ||
    date.getMonth() !== monthNumber - 1 ||
    date.getDate() !== dayNumber
  ) {
    return eventDate;
  }

  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];

  return `${monthNumber}月${dayNumber}日（${weekdays[date.getDay()]}）`;
}

function formatEventTime(timeSlot: InviteEvent["timeSlot"], timeDetail?: string) {
  const detail = timeDetail?.trim();

  return detail ? `${timeSlot} ${detail}` : timeSlot;
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
