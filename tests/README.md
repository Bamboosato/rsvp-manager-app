# CI テストの観点・前提・実行範囲

## 観点（ケース詳細化の前提）

| 分類 | 正常系 | 異常系・境界値 | 状態遷移・環境依存 |
| --- | --- | --- | --- |
| 機能 | 本人の認証、招待受付、回答の保存・再編集、正しい LINE 署名 | 未認証、別所有者、無効招待、PIN/アクセスコード不一致、署名改変 | イベント締切、セッション失効、通知や webhook イベントの部分失敗 |
| 非機能 | クリーンなインストール、監査証跡、外部サービスを呼ばない検証 | registry・フォント取得・保存の失敗、タイムアウト | Linux CI / Windows 開発、キャッシュ、同じポートでの競合 |
| データ | 正しい本番/開発依存分類、guest/owner/plan の分離、回答更新 | nickname 40/41文字、回答0/1/100/101件、コメント500/501文字 | dev→prod、依存版/経路変更、新しいアドバイザリ、期限直前/到達/経過 |
| UI | 招待→入力→回答→完了→再表示・変更 | 無効URL、アクセスコード不一致、セッションなし | 編集中の401/409、未保存の入力保持、再読み込み |

## レイヤーと検証の意図

- `scripts/security-audit-policy.test.mjs`: 合成した監査 JSON・lockfile と注入した時計で、監査ゲートが未承認の脆弱性や不正応答を誤って許可しないことを確認する。ネットワークなし。
- `tests/unit`: Vitest。実際の Cookie・ハッシュ・Next Route Handler・REST ラッパーを使い、保存や通知の境界をモックに置き換える。各ケースは新しいデータ・モックで開始する。未定義の `fetch` は例外にする。
- `scripts/firebase-security-smoke.mjs`: Firebase Web/Admin SDK を Auth・Firestore・Storage emulator に接続する。Auth/Firestore の状態を初期化し、本人/別所有者/未認証を分けて検証する。Storage の save/download で gaxios/uuid の更新経路も確認する。
- `tests/e2e/invite.spec.ts`: 実際の Next.js production build を Chromium で操作する。API 応答はケースごとの状態を持つ fixture で制御し、ページ遷移・入力・エラー・再編集を確認する。サーバーの Cookie/権限/保存ロジックは単体/API と emulator の層で別途確認する。

E2E は API 応答をモックするため、Firestore 永続化までを通した統合 E2E ではない。
SDK smoke の Admin 初期化はテスト専用であり、実サービスアカウントの秘密鍵、IAM、FCM、LINE 実送信の動作を証明しない。
現在の回答保存はトランザクション内での状態再検査を行わない。締切との実際の競合や同時新規回答が安全であることを、これらのテストの成功から推定しない。

## 前提と手順

Node.js 24 推奨（テストツールの最低要件は22.12）。Java 21 を emulator 用に用意する。
`npm ci --no-audit` で lockfile どおりに準備する。作業中の別プロセスや既存 emulator を終了し、8080/9099/9199/3100 を空ける。
同じ emulator / ブラウザー環境に対してスクリプトを並列実行しない。CI のジョブは別 runner で独立する。

```bash
npm run test:security
npm run audit:security
npm test
npm run test:sdk
npm run lint
npm run typecheck
npm run build:ci
npx --no-install playwright install chromium
npm run test:e2e -- --workers=1
```

`build:ci` と Playwright は `tests/ci-env.json` のダミー値を使う。E2E 用のビルドを本番へデプロイしない。
E2E は既存サーバーを再利用せず、service worker をブロックする。外部ドメインと未定義の API 通信は失敗させる。各ケースに新しい browser context と回答データを用意する。
SDK smoke は `demo-rsvp-ci` と localhost の環境変数を要求するため、直接本番設定で実行できない。テスト用 Storage Rules は Web の読み書きをすべて拒否する。

Windows の Java 21 で `UnixDomainSockets` の `Invalid argument: connect` が出る場合は、短い一時ディレクトリを Java に指定して再実行する。今回の Windows 検証はこの指定で成功した。設定はシェル内だけに適用し、既存の `JAVA_TOOL_OPTIONS` があれば必要な値を保持する。

```powershell
$sdkTmp = Join-Path $PWD '.ci-java-tmp'
New-Item -ItemType Directory -Path $sdkTmp -Force | Out-Null
$sdkPreviousJavaOptions = $env:JAVA_TOOL_OPTIONS
$env:JAVA_TOOL_OPTIONS = ($sdkPreviousJavaOptions + ' -Djdk.net.unixdomain.tmpdir="' + $sdkTmp + '"').Trim()
try { npm run test:sdk } finally { $env:JAVA_TOOL_OPTIONS = $sdkPreviousJavaOptions }
```

根拠: [Java の Unix domain socket 一時ディレクトリ](https://docs.oracle.com/en/java/javase/16/core/networking-properties.html)。CI の Linux/Temurin 21 では通常のコマンドで検証する。

## 証跡と切り分け

- 監査: `.security-audit/` の本番/全依存 JSON・判定要約・Node/npm・対象 SHA・時刻。例外適用と脆弱性0件を区別する。
- E2E: `playwright-report/`、`test-results/`。失敗時のみ trace・スクリーンショット・動画を保存する。再試行による失敗の隠蔽は行わない。
- emulator: `firebase-debug.log`、`firestore-debug.log`、`storage-debug.log`。期待した権限拒否と接続不能を区別する。
- Actions では成否にかかわらず生成済みの証跡を14日間保存する。生成物は Git に含めない。

失敗は、テスト観点不足・データ準備・環境（ネットワーク/ポート/ツール版）・実装を分けて確認する。
registry の応答が取得できないときは監査を失敗させ、前回の成功や空レポートに置き換えない。
SDK テストが途中で失敗した後も、次回は開始時のリセットから実行する。

## E2E 範囲

初期範囲は Chromium の招待導線6ケースのみ、worker 1。新しいCI基盤と認証/依存更新に関係するケースを選定した。
管理者画面の全件、Firefox/WebKit、モバイル実機、実 Firebase/LINE/FCM 接続、負荷・競合試験は未実施範囲であり、全件実施を既定としない。
変更した機能・影響の大きさに応じて、対象追加・クロスブラウザー・実サービスでの別検証を選ぶ。
