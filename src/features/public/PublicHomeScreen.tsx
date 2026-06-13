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

const primaryStrengths = [
  {
    title: "1つのプランから、案内したいイベントだけを選んだ専用URLを複数作成",
    body: "「7月練習会」という1つのプランのなかから、Aさんグループには土曜日のイベントだけ、Bさんグループには平日のイベントだけ、といったように案内したい日程だけを選んで、それぞれ異なる配信用URLを作成できます。URLごとに対象イベントが固定されるため、後からプラン内のイベントを並び替えたりステータスを変えたりしても、見せたいイベントが勝手に入れ替わる心配はありません。"
  },
  {
    title: "ニックネームと4桁PINで、ログイン不要なのに安全に再編集",
    body: "招待者は面倒な会員登録なしで、名前と自分で決めた4桁の数字を入れるだけで、いつでも自分の回答を修正できます。他の招待者の回答や個人情報が見えることはありません。"
  },
  {
    title: "管理者代理入力で、直接届いた回答も取りこぼさない",
    body: "URLからの回答を忘れて、直接「その日行くよ」と連絡してきたメンバーがいても大丈夫。幹事さんが管理画面から代理で出欠を追加・修正できるため、システム内外の回答を1つの画面で一元管理できます。"
  }
];

const recommendedPoints = [
  {
    title: "作成したURLは、アプリから直接LINEの友だちへ一括送信も可能",
    body: "切り出した専用URLをコピーして手動で共有できるのはもちろん、LINE配信機能を使えば、選択したイベントURLを対象のLINE友だちへアプリから直接プッシュ通知で一括送信できます。"
  },
  {
    title: "運営に耐えるデータ無効化と受付締切",
    body: "締切済にしたイベントは招待者側からの変更をブロック。データを物理削除せず無効化として扱うため、誤操作によるデータ消失を防ぎつつ、急な募集停止にも対応できます。"
  },
  {
    title: "回答があったらリアルタイムでPush通知",
    body: "招待者が回答を追加・更新すると、幹事さんのスマホへ通知が届きます。何度もアプリを開いて確認する手間を減らせます。"
  },
  {
    title: "無駄を削ぎ落とした落ち着いたビジネスUI",
    body: "白とグレーを基調にした見やすい業務アプリ風のデザインを採用。PCでは集計しやすいテーブル、スマホでは片手で操作しやすい1カラムUIで快適に使えます。"
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
              <h1 id="public-intro-heading">イベント出欠管理の決定版「RSVP Hub」</h1>
            </div>
          </div>

          <div className="public-overview-copy">
            <p className="public-lead">
              RSVP Hubは、サークルやビジネス、各種コミュニティで「複数の日程を一気に、かつスマートに調整したい」幹事さんのための出欠管理Webアプリです。
            </p>
            <p>
              特に、「同じ月やプランのイベントだけど、メンバーや曜日にあわせて案内する日程を細かく分けたい」という幹事さんのリアルな悩みを、独自のURL発行システムでスマートに解決します。
            </p>
          </div>

          <div className="public-overview-block">
            <div className="public-overview-subheading">
              <p className="eyebrow">Strengths</p>
              <h2>RSVP Hubだけの強み</h2>
            </div>
            <div className="public-overview-list public-overview-list-primary">
              {primaryStrengths.map((item, index) => (
                <article className="public-overview-item" key={item.title}>
                  <span className="public-overview-number">{index + 1}</span>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="public-overview-block">
            <div className="public-overview-subheading">
              <p className="eyebrow">Useful Points</p>
              <h2>さらに便利に使えるポイント</h2>
            </div>
            <div className="public-feature-grid public-overview-card-grid">
              {recommendedPoints.map((item) => (
                <article className="public-overview-card" key={item.title}>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              ))}
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
