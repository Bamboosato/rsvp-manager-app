import { LegalPageShell } from "@/features/legal/LegalPageShell";

export default function PrivacyPage() {
  return (
    <LegalPageShell
      description="本プライバシーポリシーは、RSVP Hubにおける利用者情報の取扱いを定めるものです。"
      title="プライバシーポリシー"
      updatedAt="2026年6月4日"
    >
      <section className="legal-section">
        <h2>1. 取得する情報</h2>
        <p>本サービスでは、サービス提供に必要な範囲で以下の情報を取得、保存、利用します。</p>
        <h3>幹事さんに関する情報</h3>
        <ul className="legal-list">
          <li>メールアドレスなど、ログイン認証に必要な情報。</li>
          <li>プラン名、年月、イベント名、日程、時間帯、場所など、幹事さんが登録する情報。</li>
          <li>通知機能を利用する場合のブラウザ通知トークン。</li>
          <li>代理回答、回答修正、PINリセット等の操作履歴。</li>
        </ul>
        <h3>招待者に関する情報</h3>
        <ul className="legal-list">
          <li>ニックネーム。</li>
          <li>本人識別用のPIN。サーバー側ではハッシュ化して保存し、平文では保存しません。</li>
          <li>出席、未定、欠席の回答、任意のコメント、回答日時、更新日時。</li>
          <li>招待者の入力負担を減らすため、利用端末のブラウザ内にアクセスコード、ニックネーム、PINを保存する場合があります。</li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>2. 利用目的</h2>
        <p>取得した情報は、以下の目的で利用します。</p>
        <ul className="legal-list">
          <li>本サービスへのログイン認証および本人確認のため。</li>
          <li>プラン、イベント、出欠回答の作成、表示、編集、集計を行うため。</li>
          <li>招待者が回答または更新した際に、対象の幹事さんへ通知を送るため。</li>
          <li>幹事さんによる代理回答、回答修正、PINリセット等の操作履歴を記録するため。</li>
          <li>お問い合わせ対応、不具合調査、保守、セキュリティ確保、不正利用防止のため。</li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>3. ブラウザ保存、Cookie、通知</h2>
        <ul className="legal-list">
          <li>本サービスは、ログイン状態、回答画面へのアクセス状態、入力補助のためにCookie、Local Storage、IndexedDB等のブラウザ保存領域を利用する場合があります。</li>
          <li>同じ端末を第三者と共有する場合、ブラウザに保存されたアクセスコード、ニックネーム、PINが第三者に見られる可能性があります。共有端末では、ブラウザの保存情報を削除するなどの対応を行ってください。</li>
          <li>通知機能を利用する場合、ブラウザ通知の許可状態および通知トークンを保存します。通知の許可はブラウザまたは端末の設定から変更できます。</li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>4. 外部サービスの利用</h2>
        <p>本サービスの提供にあたり、以下の外部サービスを利用します。</p>
        <ul className="legal-list">
          <li>ホスティング環境: Vercel</li>
          <li>認証、データベース、通知機能: Firebase Authentication、Cloud Firestore、Firebase Cloud Messaging</li>
        </ul>
        <p>
          アプリ管理者は、法令に基づく場合を除き、利用者本人の同意なく個人情報を第三者へ提供しません。
          ただし、サービス提供に必要な範囲で外部サービスに情報の取扱いを委託する場合があります。
        </p>
      </section>

      <section className="legal-section">
        <h2>5. 安全管理</h2>
        <ul className="legal-list">
          <li>幹事さんごとにデータの閲覧、編集権限を分離する設計とします。</li>
          <li>サーバー側で保存するPINおよびアクセスコードは、ハッシュ化して保存します。</li>
          <li>本サービスでは、プランやイベントの削除操作を物理削除ではなく無効化として扱います。無効化後も、保守、不具合調査、監査対応等のためにデータを保持する場合があります。</li>
          <li>不正アクセス、紛失、漏えい、改ざん等を防止するため、必要かつ適切な安全管理措置を講じます。</li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>6. 開示、訂正、利用停止等</h2>
        <p>
          利用者は、自身が画面上で編集できる情報について、画面から修正できます。
          画面上で対応できない情報の開示、訂正、利用停止等を希望する場合は、
          support@bamboosato.com までご連絡ください。内容を確認し、法令に従って合理的な範囲で対応します。
        </p>
      </section>

      <section className="legal-section">
        <h2>7. プライバシーポリシーの変更</h2>
        <p>
          アプリ管理者は、必要に応じて本ポリシーを変更できるものとします。変更後のポリシーは、本サービス上に掲示された時点から適用されます。
        </p>
      </section>

      <section className="legal-section">
        <h2>8. お問い合わせ</h2>
        <p>本ポリシーまたは利用者情報の取扱いに関するお問い合わせは、support@bamboosato.com までご連絡ください。</p>
      </section>
    </LegalPageShell>
  );
}
