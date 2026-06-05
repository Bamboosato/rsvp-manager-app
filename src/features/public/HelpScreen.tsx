"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/AuthProvider";

const operationSections = [
  {
    step: "Step1",
    title: "プランを作成する",
    body: "管理画面のマイプランから、出欠を集計する単位としてプランを作成します。",
    points: [
      "プラン名と年月を入力します。",
      "必要な場合だけアクセスコードを設定します。",
      "作成後はプラン詳細からイベントを登録します。"
    ],
    screen: "plans" as const
  },
  {
    step: "Step2",
    title: "イベントを追加する",
    body: "プラン内に、実際に出欠を取りたい日程をイベントとして登録します。",
    points: [
      "日程、時間帯、詳細、場所を入力します。",
      "初期表示のカレンダーはプラン年月に合わせます。",
      "締切後はイベント一覧で締切済に変更します。"
    ],
    screen: "events" as const
  },
  {
    step: "Step3",
    title: "共有URLを送る",
    body: "URLコピーでプラン名と回答用URLをコピーし、LINEなどで招待者へ送ります。",
    points: [
      "コピー内容はプラン名と共有URLです。",
      "アクセスコードを設定した場合は、別途招待者へ伝えます。",
      "共有URLの再発行は行わないため、送付先に注意します。"
    ],
    screen: "share" as const
  },
  {
    step: "Step4",
    title: "招待者が回答する",
    body: "招待者は共有URLを開き、ニックネームとPINで自分の回答を保存します。",
    points: [
      "回答は出席、未定、欠席から選択します。",
      "コメントは任意で入力できます。",
      "再編集時も同じニックネームとPINを使います。"
    ],
    screen: "invite" as const
  },
  {
    step: "Step5",
    title: "出欠内訳を確認する",
    body: "イベント詳細で回答状況を確認し、必要に応じて幹事さんが代理対応します。",
    points: [
      "出席、未定、欠席の人数を確認します。",
      "コメント付きの出欠一覧を確認できます。",
      "代理回答、修正、PINリセット、出欠コピーを使えます。"
    ],
    screen: "detail" as const
  }
];

const quickReferenceItems = [
  {
    title: "マイプラン",
    body: "プラン追加、URLコピー、イベント一覧への移動を行います。"
  },
  {
    title: "プラン詳細",
    body: "イベントの追加、受付状態の切り替え、出欠サマリーの確認を行います。"
  },
  {
    title: "イベント詳細",
    body: "出欠内訳、代理回答、回答修正、PINリセット、出欠コピーを行います。"
  },
  {
    title: "招待者画面",
    body: "招待者が自分の出欠を入力、再編集するための画面です。"
  }
];

const troubleItems = [
  {
    title: "招待者がPINを忘れた",
    body: "イベント詳細の出欠内訳から対象者のPINリセットを行い、新しいPINをLINE等で連絡します。"
  },
  {
    title: "締切後に変更したい",
    body: "招待者画面からは変更できません。幹事さんがイベント詳細で代理修正します。"
  },
  {
    title: "誤って作成したデータを消したい",
    body: "画面上では削除として扱い、内部的には無効化します。テストデータの物理削除はメンテナンス手順で行います。"
  }
];

const inviteMessageLines = [
  "7月練習会",
  "https://rsvphub.bamboosato.com/invite/xxxxxxxxxxxx",
  "",
  "ニックネームと4桁のPINを入力して、各日程の出欠を回答してください。",
  "再編集するときも同じニックネームとPINを使います。"
];

const loginHref = "/login?next=/admin/plans&returnTo=/help";

export function HelpScreen() {
  const router = useRouter();
  const { isLoading, user } = useAuth();

  function handleBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.replace("/admin/plans");
  }

  if (isLoading) {
    return (
      <main className="public-page">
        <section className="loading-panel" role="status" aria-live="polite">
          読み込み中...
        </section>
      </main>
    );
  }

  if (user) {
    return (
      <main className="app-shell">
        <header className="top-bar">
          <div className="title-row">
            <button
              className="back-link"
              data-tooltip="前の画面へ戻る"
              onClick={handleBack}
              type="button"
            >
              <span>←</span>
              <span>戻る</span>
            </button>
            <h1>ヘルプ/操作説明</h1>
          </div>
        </header>

        <div className="public-content admin-help-content">
          <HelpContent showTitle={false} />
        </div>
      </main>
    );
  }

  return (
    <main className="public-page">
      <header className="public-header">
        <Link
          aria-label="トップへ戻る"
          className="public-brand header-mark brand-mark"
          data-tooltip="トップへ戻る"
          href="/"
        >
          <span>RSVP</span>
          <span>HUB</span>
        </Link>
        <Link className="primary-button button-link" data-tooltip="管理画面にログイン" href={loginHref}>
          ログイン
        </Link>
      </header>

      <div className="public-content">
        <HelpContent />
      </div>
    </main>
  );
}

function HelpContent({ showTitle = true }: { showTitle?: boolean }) {
  return (
    <>
      <section className="public-section">
        <p className="eyebrow">Help</p>
        {showTitle ? <h1>ヘルプ/操作説明</h1> : null}
        <p className="public-lead">
          RSVP Hubは、幹事さんが招待者の出欠回答を集計するための管理ツールです。
          ここではアプリ内で利用する基本操作をまとめています。
        </p>
        <div className="public-feature-grid">
          <div>
            <strong>管理画面</strong>
            <span>プラン、イベント、出欠内訳をテーブル中心で確認します。</span>
          </div>
          <div>
            <strong>招待者画面</strong>
            <span>スマホで出席、未定、欠席を選びやすい1カラム構成です。</span>
          </div>
          <div>
            <strong>運用対応</strong>
            <span>締切後の変更やPIN忘れは、幹事さんが管理画面から対応します。</span>
          </div>
        </div>
      </section>

      <section className="public-section" aria-labelledby="help-flow-heading">
        <div className="public-section-heading">
          <span className="public-section-icon" aria-hidden="true">
            <Image alt="" height={32} src="/icons/rsvp-hub-icon.svg" width={32} />
          </span>
          <div>
            <p className="eyebrow">Operation</p>
            <h2 id="help-flow-heading">基本操作</h2>
          </div>
        </div>

        <div className="help-guide-list">
          {operationSections.map((section) => (
            <article className="help-guide-card" key={section.step}>
              <div className="help-guide-copy">
                <span className="help-step-badge">{section.step}</span>
                <h3>{section.title}</h3>
                <p>{section.body}</p>
                <ul className="help-point-list">
                  {section.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </div>
              <HelpScreenMock variant={section.screen} />
            </article>
          ))}
        </div>
      </section>

      <section className="public-section" aria-labelledby="help-reference-heading">
        <div className="public-section-heading">
          <span className="public-section-icon" aria-hidden="true">
            <Image alt="" height={32} src="/icons/rsvp-hub-icon.svg" width={32} />
          </span>
          <div>
            <p className="eyebrow">Reference</p>
            <h2 id="help-reference-heading">画面別の確認ポイント</h2>
          </div>
        </div>

        <div className="help-reference-grid">
          {quickReferenceItems.map((item) => (
            <article className="help-reference-item" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="public-section" aria-labelledby="help-message-heading">
        <div className="public-section-heading">
          <span className="public-section-icon" aria-hidden="true">
            <Image alt="" height={32} src="/icons/rsvp-hub-icon.svg" width={32} />
          </span>
          <div>
            <p className="eyebrow">Share</p>
            <h2 id="help-message-heading">招待者へ送る文面例</h2>
          </div>
        </div>

        <div className="help-message-sample" aria-label="共有文面例">
          {inviteMessageLines.map((line, index) =>
            line ? <p key={`${line}-${index}`}>{line}</p> : <br key={`blank-${index}`} />
          )}
        </div>
      </section>

      <section className="public-section" aria-labelledby="help-notes-heading">
        <div className="public-section-heading">
          <span className="public-section-icon" aria-hidden="true">
            <Image alt="" height={32} src="/icons/rsvp-hub-icon.svg" width={32} />
          </span>
          <div>
            <p className="eyebrow">Notes</p>
            <h2 id="help-notes-heading">運用上の注意</h2>
          </div>
        </div>

        <ul className="public-note-list">
          <li>招待者へ送る共有URLは、プラン詳細のURLコピーから取得します。</li>
          <li>締切済のイベントは、招待者画面から回答変更できません。</li>
          <li>PINを忘れた招待者には、幹事さんがPINリセット後に新しいPINを連絡します。</li>
          <li>ログインアカウントは、幹事さんのメールアドレスをもとにアプリ管理者が作成・提供します。</li>
        </ul>
      </section>

      <section className="public-section" aria-labelledby="help-trouble-heading">
        <div className="public-section-heading">
          <span className="public-section-icon" aria-hidden="true">
            <Image alt="" height={32} src="/icons/rsvp-hub-icon.svg" width={32} />
          </span>
          <div>
            <p className="eyebrow">Trouble</p>
            <h2 id="help-trouble-heading">よくある対応</h2>
          </div>
        </div>

        <div className="help-trouble-list">
          {troubleItems.map((item) => (
            <article className="help-trouble-item" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

type HelpScreenMockVariant =
  | "plans"
  | "events"
  | "share"
  | "invite"
  | "detail";

function HelpScreenMock({ variant }: { variant: HelpScreenMockVariant }) {
  if (variant === "plans") {
    return (
      <div className="help-screen-mock" aria-label="マイプラン画面イメージ">
        <div className="help-mock-header">
          <span className="help-mock-logo">RSVP<br />HUB</span>
          <strong>マイプラン</strong>
        </div>
        <div className="help-mock-badges">
          <span>プラン 2</span>
          <span>イベント 5</span>
        </div>
        <div className="help-mock-table">
          <div className="help-mock-row help-mock-head">
            <span>プラン名</span>
            <span>年月</span>
            <span>操作</span>
          </div>
          <div className="help-mock-row">
            <strong>7月練習会</strong>
            <span>2026年07月</span>
            <span>URLコピー</span>
          </div>
          <div className="help-mock-row">
            <strong>8月練習会</strong>
            <span>2026年08月</span>
            <span>イベント</span>
          </div>
        </div>
      </div>
    );
  }

  if (variant === "events") {
    return (
      <div className="help-screen-mock" aria-label="イベント一覧画面イメージ">
        <div className="help-mock-header">
          <span className="help-mock-back">←<br />戻る</span>
          <strong>7月練習会</strong>
        </div>
        <div className="help-mock-badges">
          <span>イベント 3</span>
          <span>受付中 2</span>
          <span>締切済 1</span>
        </div>
        <div className="help-mock-table">
          <div className="help-mock-row help-mock-head">
            <span>イベント</span>
            <span>日程</span>
            <span>状態</span>
          </div>
          <div className="help-mock-row">
            <strong>7月 1つめ</strong>
            <span>7月11日(土) AM</span>
            <span className="help-mock-status">受付中</span>
          </div>
          <div className="help-mock-row">
            <strong>7月 2つめ</strong>
            <span>7月18日(土) PM</span>
            <span className="help-mock-status muted">締切済</span>
          </div>
        </div>
      </div>
    );
  }

  if (variant === "share") {
    return (
      <div className="help-screen-mock" aria-label="共有URLコピー画面イメージ">
        <div className="help-mock-header">
          <span className="help-mock-back">←<br />戻る</span>
          <strong>プラン詳細</strong>
        </div>
        <div className="help-mock-share">
          <span>共有URL</span>
          <button type="button">URLコピー</button>
          <small>コピーしました</small>
        </div>
        <div className="help-mock-message">
          <strong>7月練習会</strong>
          <span>https://rsvphub.bamboosato.com/invite/...</span>
        </div>
      </div>
    );
  }

  if (variant === "invite") {
    return (
      <div className="help-screen-mock help-screen-mock-phone" aria-label="招待者回答画面イメージ">
        <p className="eyebrow">Responses</p>
        <h3>7月練習会</h3>
        <span className="help-mock-subtitle">もんもん / 2026年07月</span>
        <div className="help-mock-invite-card">
          <strong>7月11日(土) AM</strong>
          <span>7月イベント 1つめ</span>
          <div className="help-mock-attendance">
            <button type="button">○</button>
            <button className="selected" type="button">△</button>
            <button type="button">×</button>
          </div>
          <span className="help-mock-comment">コメント</span>
        </div>
      </div>
    );
  }

  return (
    <div className="help-screen-mock" aria-label="出欠内訳画面イメージ">
      <div className="help-mock-header">
        <span className="help-mock-back">←<br />戻る</span>
        <strong>7月イベント</strong>
      </div>
      <div className="help-mock-badges">
        <span>出席 8</span>
        <span>未定 2</span>
        <span>欠席 1</span>
      </div>
      <div className="help-mock-table">
        <div className="help-mock-row help-mock-head">
          <span>ニックネーム</span>
          <span>出欠</span>
          <span>操作</span>
        </div>
        <div className="help-mock-row">
          <strong>佐藤</strong>
          <span>○</span>
          <span>修正</span>
        </div>
        <div className="help-mock-row">
          <strong>加藤</strong>
          <span>△</span>
          <span>PINリセット</span>
        </div>
      </div>
    </div>
  );
}
