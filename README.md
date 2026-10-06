# RSVP Hub

プランとイベントを作成し、招待者の出欠を集計するWebアプリです。
本番URL: [RSVP Hub](https://rsvphub.bamboosato.com)

## 実装済みの機能

- 管理者のメール・パスワードログイン、ログアウト、パスワードリセット。アカウントはFirebase Consoleで手動作成します。
- 管理者ごとのデータ分離。有効プランは最大3件で、作成・編集・削除（無効化）に対応します。
- イベントの日程・AM/PM・任意の時間帯詳細・場所・任意名称の管理、受付中／締切済の切り替え、削除（無効化）。
- イベント別の出欠サマリー・内訳・コメント確認、出欠コピー、管理者による代理追加・修正・回答削除（無効化）、PINリセット。
- 受付中イベントを選んで発行する短縮招待URL `/i/{inviteCode}`。各URLの対象イベント集合は発行時に固定されます。
- 招待者はアカウント不要。任意のアクセスコード（6〜12桁数字）と、ニックネーム・4桁PINで回答・再編集します。他人の回答は表示しません。
- アカウント設定からLINE登録用URL・QRを共有し、登録コードの送信で友だちを紐づけます。メモ編集、配信対象変更、友だちの無効化に対応します。
- 管理者がイベント・LINE友だち・挨拶文を選び、招待URLを手動配信します。送信先別の結果と成功／失敗件数を表示します。
- 招待者の回答保存時に、通知を許可した管理者端末へFCM Push通知を送ります。管理者の代理操作では送信しません。
- PWA manifest、Service Worker、対応端末でのアプリアイコンバッジ、公開トップ・ヘルプ・利用規約・プライバシーポリシー。

自己登録、管理者同士の共同管理、定員制限、プラン有効期限設定、定期配信・自動リマインダー、参加者データのインポート／エクスポートは未実装です。
LINE友だちと回答者のニックネームは自動では紐づきません。
通常画面の削除は無効化です。物理削除は開発者向けのメンテナンスのみ提供します。

## Tech Stack

- Next.js App Router
- TypeScript
- Firebase / Firestore
- Firebase Cloud Messaging
- Firebase Storage（LINEプロフィール画像）
- LINE Messaging API
- Vercel

## Setup

Use Node.js 24 and npm 11.19.0 (minimum Node.js 22.12). Firebase Admin SDK 14
requires Node.js 22 or later, and the test tooling requires Node.js 22.12 or
later. Use a supported Node.js version in development and deployment.

```bash
npm install
```

Create `.env.local` from `.env.example` and set the Firebase Web App values.
Invite APIs also require Firebase Admin SDK server credentials.
The canonical production URL is `https://rsvphub.bamboosato.com`.

```bash
cp .env.example .env.local
```

PowerShellでは `Copy-Item .env.example .env.local` を使えます。
Firebase AuthenticationのEmail/Password認証を有効にし、管理者のAuthユーザーを作成してください。

Core configuration values:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_VAPID_KEY`
- `NEXT_PUBLIC_APP_BASE_URL`
- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY`
- `INVITE_SESSION_SECRET`

`FIREBASE_ADMIN_PROJECT_ID` は未設定時に `NEXT_PUBLIC_FIREBASE_PROJECT_ID` を使います。
Admin秘密鍵のリテラル `\n` は実装で改行に変換されます。
`INVITE_SESSION_SECRET` は専用の長いランダム値を設定してください。実装上は未設定時にAdmin秘密鍵へフォールバックします。

`NEXT_PUBLIC_FIREBASE_VAPID_KEY` is the Web Push certificate public key from
Firebase Console > Cloud Messaging.
Set `NEXT_PUBLIC_APP_BASE_URL` to `https://rsvphub.bamboosato.com` in production
so shared invite URLs and notification links use the custom domain. Leave it
blank for local development to use the current browser origin.
VAPIDキーが未設定でも、通知以外の出欠管理は利用できます。

Production domain checklist:

- Vercel project domain: `rsvphub.bamboosato.com`
- Vercel Production environment variable:
  `NEXT_PUBLIC_APP_BASE_URL=https://rsvphub.bamboosato.com`
- Firebase Authentication Authorized domains:
  `rsvphub.bamboosato.com`

## Scripts

```bash
npm run dev
npm run typecheck
npm run lint
npm run build
npm run start
npm test
npm run test:security
npm run audit:security
npm run test:sdk
npm run build:ci
npm run test:e2e -- --workers=1
```

`start` は `build` 後の本番サーバー起動です。テストの前提条件と実行範囲は以下のCI説明とテスト手順を確認してください。

## CI and Dependency Security

GitHub Actions checks main pull requests and pushes with Node.js 24: lint,
typecheck, unit/API tests, build, Chromium E2E, dependency audits, and Firebase
Web/Admin SDK smoke tests against local Auth/Firestore/Storage emulators.
A weekly audit runs on Mondays at 07:00 JST. Dependabot proposes weekly npm and
GitHub Actions updates; updates are not automatically merged.

Any production vulnerability fails the audit. Development vulnerabilities require
an exact, time-limited exception; critical vulnerabilities cannot be excepted.
Audit failures and malformed responses fail the check too. JSON reports and
failure evidence are retained for 14 days.

Node.js 24 and npm 11.19.0 are recommended (minimum Node 22.12); emulator checks require Java 21.
E2E uses a dummy Firebase build and mocked APIs, with one Chromium worker.
Use `npm run build:ci` before E2E, and install Chromium with
`npx --no-install playwright install chromium`. Do not deploy the dummy build.

See [CI operations](docs/ci-operations.md) for dependency overrides, the current
development exception expiry, and required checks. See
[test scope and prerequisites](tests/README.md) for coverage and limitations.

## Firebase

Firestore Rules and indexes are managed in this repository.

```bash
npx firebase deploy --only firestore:rules,firestore:indexes
```

LINE関連コレクションと `inviteShareTokens` はサーバーAPI経由で扱います。
LINE画像用Storage bucketを用意し、必要なら [cors.json](cors.json) のoriginを環境に合わせて適用してください。
上記のFirestoreデプロイはStorageの設定を行いません。

## LINE Setup

| 環境変数 | 設定内容 |
| --- | --- |
| `LINE_DEFAULT_ACCOUNT_ID` | 既定は `default`。登録データの区分に使用します。 |
| `LINE_BASIC_ID` | 公式アカウントのBasic ID（`@...`）。登録用URLの生成に必要です。 |
| `LINE_CHANNEL_SECRET` | Webhook署名検証用。サーバー専用です。 |
| `LINE_CHANNEL_ACCESS_TOKEN` | プロフィール取得・返信・配信用。サーバー専用です。 |
| `FIREBASE_ADMIN_STORAGE_BUCKET` | 画像保存先bucket名。未設定時は `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` を使います。 |

`.env.example` の `LINE_CHANNEL_ID` は現在のコードでは参照していません。
LINEの資格情報は現在1組の環境変数から読みます。複数公式アカウントの独立した資格情報管理は未実装です。

1. 公式アカウントのMessaging APIを有効にし、上表の設定を行います。
2. Webhook URLを `https://rsvphub.bamboosato.com/api/line/webhook/default` に設定し、Webhook利用を有効にします。IDを変更した場合は末尾を合わせます。
3. 友だち追加時のあいさつメッセージに `表示された登録コードをそのまま送信してください！` を追記します。この文言はアプリから自動設定されません。
4. 管理画面の「アカウント設定」でURL／QRを共有します。招待者がLINEの入力欄にセットされたコードを送信すると、その管理者の友だち一覧に登録されます。
5. マイプランまたはプラン詳細の「LINE配信」からイベント・配信先・挨拶文を指定します。

友だち追加だけでは管理者への紐づけは完了しません。登録コードの送信が必要です。
配信は1回あたりイベント1〜100件、友だち1〜50件、挨拶文500文字以内です。
挨拶文は空欄も許可され、末尾には招待URLが付与されます。アクセスコードは別途知らせてください。
成功はLINE APIの受付を意味し、既読や端末への到達を保証しません。

## 招待URLと運用上の制約

- 本番の共有URLは `https://rsvphub.bamboosato.com/i/{inviteCode}`。新規コードは紛らわしい文字を除いた英大文字・数字6文字です。
- 旧 `/invite/{publicToken}?share=...` の画面・APIは現行実装にありません。現行画面からURLを作成して共有します。
- 同じプランでもURL発行ごとにコードが変わります。過去の有効URLは、そのURLに保存されたイベント集合を引き続き参照します。
- 発行後に締切済となったイベントは表示されますが、招待者は更新できません。無効化されたイベントは表示されません。プラン削除で関連URLも無効化されます。
- ニックネームは40文字、回答コメントは500文字以内。PINは文字列で `0000` も使えます。
- 招待者セッションとアクセスコード通過Cookieは24時間有効です。PIN・アクセスコード変更時に発行済みCookieを即時失効させる機能はありません。
- 回答保存・LINE配信にはネットワークが必要です。オフラインでの編集同期は未実装です。
- 通知許可・PWA・バッジの利用可否は端末とブラウザに依存します。ローカルホストではService Workerを解除しキャッシュを消すため、本番相当のPWA確認にはHTTPS環境を使います。
- LINEの部分失敗後に全件を再送すると、成功済みの宛先にも再送されます。自動リトライや送信要求の重複排除はありません。

## Maintenance

Developer-only Firestore cleanup commands are available for small, explicit
maintenance tasks. The plan cleanup command is dry-run by default.

```bash
npm run maintenance:delete-plan -- --planId <planId>
```

To physically delete matching documents:

```bash
npm run maintenance:delete-plan -- --planId <planId> --execute
```

The command deletes related documents in this order:

1. `responses`
2. `guests`
3. `events`
4. `inviteShareTokens`
5. `lineMessageDeliveries`
6. `plans`

`auditLogs` are reported but kept by default. Add `--include-audit-logs` only
when cleaning disposable test data. Active plans require `--force-active` when
using `--execute`.

`--include-audit-logs` 指定時は、監査ログをプランより前に削除します。
管理者単位のLINE登録コード・友だち・通知token・Storage画像はこのコマンドの削除対象に含まれません。
実行前に環境変数の接続先Firebaseプロジェクトと対象planIdを確認してください。

## Documents

- [要件定義](docs/mvp-requirements.md)
- [システム設計](docs/system-design.md)
- [画面仕様](docs/screen-specification.md)
- [LINE登録コード方式](docs/line-registration-code-design.md)
- [現行操作の補足（LINE・短縮URL・PDFとの相違）](docs/operations-guide.md)
- [実装と文書の整合確認・未保証事項](docs/implementation-audit.md)
- [アプリアイコン案](docs/app-icon-concepts.md)
- [管理者向けPDF](public/manuals/rsvp-hub-admin-manual.pdf) / [招待者向けPDF](public/manuals/rsvp-hub-guest-manual.pdf)

PDFはLINE連携追加前の操作説明です。現行との差分は操作の補足を併読してください。
