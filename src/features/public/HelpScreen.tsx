"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/AuthProvider";

const guideSections = [
  {
    title: "1. プランを作成する",
    body: "管理画面でプラン名と対象年月を登録します。必要に応じてアクセスコードを設定できます。"
  },
  {
    title: "2. イベントを追加する",
    body: "日程、時間帯、場所を登録します。イベントごとに受付中、締切済を切り替えます。"
  },
  {
    title: "3. URLを共有する",
    body: "プラン詳細のURLコピーから共有用の文面をコピーし、LINEなどで招待者へ送ります。"
  },
  {
    title: "4. 招待者が回答",
    body: "招待者が回答用Webページで出欠を回答して保存します。"
  },
  {
    title: "5. 回答状況を確認する",
    body: "出席、未定、欠席の件数と出欠内訳を確認します。必要に応じて代理回答やPINリセットを行います。"
  }
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
          {guideSections.map((section) => (
            <article className="help-guide-row" key={section.title}>
              <h3>{section.title}</h3>
              <p>{section.body}</p>
            </article>
          ))}
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
    </>
  );
}
