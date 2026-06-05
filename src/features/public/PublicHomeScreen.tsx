"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/features/auth/AuthProvider";

const tutorialSteps = [
  {
    label: "Step1",
    title: "プランを作成",
    body: "イベントをまとめる単位として、プラン名と対象年月を登録します。"
  },
  {
    label: "Step2",
    title: "イベントを登録",
    body: "日程、時間帯、場所を登録し、受付中または締切済を管理します。"
  },
  {
    label: "Step3",
    title: "URLを共有",
    body: "URLコピーで共有用テキストを作成し、LINEなどで招待者へ送ります。"
  },
  {
    label: "Step4",
    title: "招待者が回答",
    body: "招待者が回答用Webページで出欠を回答して保存します。"
  },
  {
    label: "Step5",
    title: "出欠を集計",
    body: "出席、未定、欠席の件数と出欠内訳を管理画面で確認します。"
  }
];

const loginHref = "/login?next=/admin/plans&returnTo=/";

export function PublicHomeScreen() {
  const router = useRouter();
  const { isLoading, user } = useAuth();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace("/admin/plans");
    }
  }, [isLoading, router, user]);

  if (isLoading || user) {
    return (
      <main className="public-page">
        <section className="loading-panel" role="status" aria-live="polite">
          読み込み中...
        </section>
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
        <section className="public-section public-intro" aria-labelledby="public-intro-heading">
          <div className="public-section-heading">
            <span className="public-section-icon" aria-hidden="true">
              <Image alt="" height={32} src="/icons/rsvp-hub-icon.svg" width={32} />
            </span>
            <div>
              <p className="eyebrow">Overview</p>
              <h1 id="public-intro-heading">イベント出欠を管理画面で集計</h1>
            </div>
          </div>
          <p className="public-lead">
            RSVP Hubは、幹事さんがプラン単位で共有URLを作成し、招待者の出席、未定、欠席を効率よく確認するためのWebアプリです。
          </p>
          <div className="public-feature-grid">
            <div>
              <strong>共有URL</strong>
              <span>プランごとに回答用URLをコピー</span>
            </div>
            <div>
              <strong>出欠集計</strong>
              <span>出席、未定、欠席を一覧で確認</span>
            </div>
            <div>
              <strong>代理対応</strong>
              <span>幹事さんによる代理回答とPINリセット</span>
            </div>
          </div>
        </section>

        <section className="public-section" aria-labelledby="public-tutorial-heading">
          <div className="public-section-heading">
            <span className="public-section-icon" aria-hidden="true">
              <Image alt="" height={32} src="/icons/rsvp-hub-icon.svg" width={32} />
            </span>
            <div>
              <p className="eyebrow">Tutorial</p>
              <h2 id="public-tutorial-heading">チュートリアル</h2>
            </div>
          </div>

          <div className="public-step-list">
            {tutorialSteps.map((step) => (
              <article className="public-step-row" key={step.label}>
                <span>{step.label}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="public-section public-help-link" aria-label="ヘルプへのリンク">
          <p>アプリの詳しい説明はこちら</p>
          <Link className="secondary-button button-link" data-tooltip="ヘルプ/操作説明を開く" href="/help">
            ヘルプ/操作説明
          </Link>
        </section>
      </div>
    </main>
  );
}
