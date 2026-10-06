# CI・依存関係検証の導入案

検討日: 2026-10-06。ステータス: CI・テスト基盤を実装。以下は検討時点の方針と状態を記録したもの。実装の運用情報は [CI運用](ci-operations.md)、観点と範囲は [テスト説明](../tests/README.md) を参照する。GitHub 実行結果と保護設定は導入 PR に記録する。

## 結論

`tennis-organizing-app` と同様に、インストールの再現性、静的チェック、脆弱性監査、Firebase SDK の互換性確認を GitHub Actions に導入することを推奨する。
本番依存の脆弱性は重大度を問わず失敗扱いとし、開発依存の例外は期限・バージョン・依存経路・アドバイザリを限定する。参照プロジェクトの例外リストは転用しない。
テスト基盤の違いがあるため、以下の二段階で導入する。

1. 第1段階: lint・型検査・ビルド、監査と監査ポリシーのテスト、Firebase Web/Admin SDK のスモークテスト。
2. 第2段階: 認証・招待・RSVP・LINE のアプリ固有テスト、対象を絞った Chromium E2E。

## 検討時に確認した状態

GitHub main の確認対象は [`a72e934`](https://github.com/Bamboosato/rsvp-manager-app/commit/a72e934a8315e8670ba25ba8be3347b59a9b4419)。検討中に [Dependabot PR #34](https://github.com/Bamboosato/rsvp-manager-app/pull/34) が取り込まれている。
ローカルの文書修正ブランチはこの更新を含まないため、依存バージョンの判断には GitHub main を使用した。

| 項目 | GitHub main の状態 | 導入への影響 |
| --- | --- | --- |
| GitHub Actions | `.github/workflows` のファイルなし | ワークフローを新規追加する必要がある |
| 既存コマンド | `lint`、`typecheck`、`build` あり | そのまま呼び出せる |
| テスト | `test`、`test:security`、`test:e2e` コマンドなし | コマンドだけをコピーしても実行できない |
| Firebase | Web SDK `12.14.0`、Admin SDK 指定 `^14.5.0` | Admin SDK のメジャー更新を含むため互換性確認を優先する |
| Next.js / ESLint config | ともに `16.3.6` | lockfile を使ったインストールとビルド確認が必要 |
| Firebase REST 呼び出し | `serverApi.ts` が Auth・Firestore の本番ドメインを直接構築 | SDK 用エミュレーター設定だけではアプリの REST 経路を検証できない |
| Firebase Admin 初期化 | サービスアカウント情報を要求 | SDK 単体テストとアプリ初期化の検証を区別する |
| 外部サービス | Firebase、LINE、Google Fonts | アプリテストの通信先を制御し、ビルド時のフォント取得失敗は環境要因として識別する |
| Dependabot | 更新 PR の運用実績あり。対象 main のツリーに設定 YAML なし | GitHub 側の設定と更新 PR の運用を確認し、監査ゲートと併用する |

Vercel のデプロイチェックと、依存関係の脆弱性を理由にマージを止める Actions は別の確認である。
検討段階では、更新後の main の lockfile を使った `npm ci`・監査・ビルドは実行していなかった。導入時は最新 main を取得し、監査と修正後の検証を行っている。旧ブランチの結果を現在の main の合格の証拠には使わない。

## 参照プロジェクトとの比較

参照: [tennis-organizing-app の CI](https://github.com/Bamboosato/tennis-organizing-app/blob/main/.github/workflows/ci.yml)、[監査ポリシー](https://github.com/Bamboosato/tennis-organizing-app/blob/main/scripts/security-audit-policy.mjs)、[期限付き例外](https://github.com/Bamboosato/tennis-organizing-app/blob/main/security-audit-exception.json)。

| 参照プロジェクトの設定 | RSVP Hub での提案 |
| --- | --- |
| main 向け PR・main push、Ubuntu、Node.js 24 | 同じ構成を基本にする。手動実行も追加する |
| `npm ci` → lint → 型検査 →テスト →監査 → SDK smoke → build → E2E | 第1段階のジョブを分け、アプリテスト・E2E は第2段階で追加する |
| `tsc --noEmit` | RSVP Hub の `npm run typecheck` を使い、Next.js の型生成も行う |
| Vitest と Playwright | 既存基盤がないため、導入・データ準備・通信制御を先に設計する |
| 本番監査・全依存監査、期限付き開発依存例外 | 同じ判断原則を採用する。対象パッケージ・期限は RSVP Hub で個別評価する |
| Java 21、固定版 Firebase CLI、Auth / Firestore emulator | 同じ構成を候補にし、Web SDK と Admin SDK の両方を確認する |
| 監査 JSON の常時保存 | 成否にかかわらず保存し、ポリシー判断の要約も残す |
| Chromium E2E、worker 1 | 第2段階の初期範囲に採用する。全ブラウザー・全件を既定にしない |
| 定期実行なし | 新しいアドバイザリと例外期限を検出するため、週1回の監査専用実行を追加提案する |

参照プロジェクトの [main 実行](https://github.com/Bamboosato/tennis-organizing-app/actions/runs/37408566015) は成功しているが、その結果は RSVP Hub の合格を証明しない。

## 第1段階の構成

### ジョブと実行条件

| ジョブ案 | 主な手順 | 実行条件 |
| --- | --- | --- |
| `verify` | checkout → Node 24 → `npm ci` → `npm run lint` → `npm run typecheck` → `npm run build` | main 向け PR、main push、手動 |
| `dependency-security` | checkout → Node 24 → `npm ci` →監査ポリシーテスト →本番・全依存監査 →レポート保存 | main 向け PR、main push、手動、週1回 |
| `firebase-sdk-smoke` | checkout → Node 24 → `npm ci` → Java 21 → Auth / Firestore emulator → Web/Admin SDK 検証 | main 向け PR、main push、手動 |

ジョブは独立させ、ビルド失敗時にも監査結果を得られるようにする。各 emulator ジョブ内の検証は直列実行とし、プロセス間で同じポート・データを共有しない。
Actions の基本権限は `contents: read`。同一 PR の古い実行は concurrency で中止し、ジョブにタイムアウトを設ける。
Actions の参照は導入時に確認したコミット SHA に固定し、Node・npm・Firebase CLI の実際の版をログに残す。Firebase CLI は参照プロジェクトの `15.17.0` を候補として実行確認後に固定する。
npm キャッシュは lockfile に基づくものとし、`node_modules` や `.next` は共有しない。

`npm ci` は manifest と lockfile が一致しなければ失敗し、lockfile を書き換えない。既存 `node_modules` を削除するため、導入検証は作業中のチェックアウトを避け、専用のクリーンなチェックアウトで行う。[npm ci 仕様](https://docs.npmjs.com/cli/v11/commands/npm-ci/)

### 監査ゲート

- `npm audit --omit=dev --json` と `npm audit --json` の両方を実行する。
- 本番依存の検出は全重大度で失敗。全依存の検出は、有効な開発依存例外に一致するものだけを許可する。
- 例外は package 名・lockfile 内の node パス・確定バージョン・`dev: true`・アドバイザリ URL・期限・理由を持つ。間接依存も原因となるアドバイザリまで確認する。
- critical は例外不可。同じパッケージに新しいアドバイザリが加わった場合、期限切れ・依存経路変更・本番依存への移動の場合は失敗させる。
- 例外期限や対象バージョンの自動延長はしない。解消時には例外も削除する。
- npm の実行エラー、タイムアウト、不正 JSON、`error` 応答、重大度・件数の不整合は「問題なし」と扱わず失敗させる。
- 監査結果と実行環境・対象 SHA を artifact に保存する。保存期間の初期案は14日。例外適用件数を明記し、脆弱性0件との違いが分かるようにする。

単に `--audit-level=high` を付けると moderate 以下では失敗しなくなるため、今回の参照ポリシーの再現には不十分である。[npm audit 仕様](https://docs.npmjs.com/cli/v11/commands/npm-audit/)
監査スクリプトは終了コードだけに頼らず JSON を評価する。CI 内で `npm audit fix` や `--force` による依存更新は実行しない。
監査ポリシーのテストには Node.js 標準テストランナーを使用でき、アプリ用テストフレームワークの導入を前提にしない。

### Firebase と通信の前提

Firebase のビルド用公開設定にはダミー値を使う。実サービスの管理秘密鍵、LINE アクセストークン、ユーザーデータは Actions に渡さない。fork PR も通常の `pull_request` で実行する。
SDK テストは明示的な `--project demo-rsvp-ci` と専用 emulator 設定を使い、各 SDK の接続先を localhost に設定する。実プロジェクトの `.firebaserc` に依存しない。[Firebase の demo project と接続設定](https://firebase.google.com/docs/emulator-suite/connect_auth)

Web SDK の Auth 操作・Firestore 読み書き、Admin SDK のトークン検証・Firestore 読み書きが最初の対象となる。データ初期化と終了処理をスクリプト内で行う。
Admin SDK は emulator 用に資格情報を要求しない初期化をテスト側で構成する。この結果だけで、アプリのサービスアカウント初期化・本番 IAM・Storage 操作まで検証済みとはしない。
Firestore Rules の許可・拒否ケースは Web SDK のユーザー権限で別途検証する。Admin SDK の成功は Rules の検証にはならない。

`serverApi.ts` の REST 経路と LINE 呼び出しは、SDK 設定を追加するだけでは通信先が変わらない。第2段階でアプリのテスト可能な通信境界を用意し、REST モックまたは emulator 向けの明示的な接続を使う。
テスト時は未許可の外向き通信を失敗させる。ビルドに必要な Google Fonts・npm・emulator 配布物の取得と、アプリが実データを扱う通信を区別する。

## テスト観点と導入時の受け入れ条件

ケース詳細化の前に、以下の観点を確認する。

| 観点 | 正常系 | 異常系・境界値 | 状態遷移・前提の崩れ |
| --- | --- | --- | --- |
| 機能 | lint・型検査・ビルド・SDK 操作の成功 | 認証拒否、読み書き拒否、コンパイル失敗 | SDK 更新前後でアプリが必要とする API の動作を維持する |
| 非機能 | クリーン環境で再現可能、必要な証跡を保存 | registry 障害、タイムアウト、Google Fonts 取得失敗 | キャッシュあり／なし、古い PR 実行の中止、外部サービスへの誤接続を防ぐ |
| データ | 本番・開発依存を正しく分類、テストデータを初期化 | 不正 JSON、未知の重大度、件数不整合、lockfile 不一致 | 例外の期限直前／期限到達、dev → prod、依存経路変更、新規アドバイザリ |
| UI | 第2段階で招待から回答までの主要導線を確認 | 無効招待、期限切れセッション、入力境界 | 回答変更、再読み込み、ログアウト、別ユーザーへのデータ混入を防ぐ |

第1段階の必須受け入れ条件:

1. ダミー公開設定とクリーンな lockfile インストールで lint・型検査・ビルドが成功する。
2. 監査ポリシーのテストが、0件・本番の low 1件・全依存の未承認検出・有効例外・期限到達・新規アドバイザリ・critical・不正応答を区別して合否を確認する。時計は注入して期限境界を再現する。
3. 監査失敗時もレポートを保存する。通信失敗と脆弱性検出の原因をログから区別できる。
4. SDK スモークテストが demo project のローカル emulator だけで成功し、データを初期化する。認証・権限拒否の期待結果も確認する。
5. PR の対象コミットに必要なジョブが実行され、1つでも失敗した PR をマージ可能にしない。必須チェックの登録は、導入 PR で正常実行を確認してから GitHub の保護設定へ反映する。

新しいアドバイザリは同じ lockfile に対しても増えるため、前回の成功を現在の合格の代用にしない。定期監査と期限付き例外で継続検出する。

## 第2段階と優先順位

優先度はユーザー・データへの影響を基準とする。

1. 最優先: 認証・権限、招待コード/PIN、セッション期限、管理者とゲストのデータ分離を検証する。
2. 次点: RSVP の追加・変更・削除、終了/無効イベントの拒否、重複や同時更新、LINE webhook 署名と部分失敗を検証する。
3. UI: 実サービスを呼ばないデータ準備・通信制御を整え、Chromium の招待→回答→回答変更と主要な拒否導線を E2E 対象にする。

E2E の初期案は対象ケースのみ、worker 1。本番接続・実 LINE 送信・全件・クロスブラウザー・実機検証は初期範囲外とし、修正内容とリスクに応じて拡張する。
検討段階では E2E を実行していなかった。導入時は対象6ケースを用意し、Chromium で検証する。初期範囲と未実施範囲は [テスト説明](../tests/README.md) に記録する。

## 実装時に追加するファイルと進め方

第1段階の候補: `.github/workflows/ci.yml`、監査実行/判定スクリプト、その Node テスト、Firebase スモークスクリプト・専用 emulator 設定、必要な npm scripts、README の CI 説明。
例外ファイルは、最新 main の監査結果を個別評価したうえで作成する。初期値に参照プロジェクトの例外を持ち込まない。

実装開始時に最新 main と lockfile を再確認し、専用チェックアウトで本番・全依存の監査を実行する。検出内容に応じて依存更新または限定した開発依存例外を準備し、上記の受け入れ条件を検証する。
Dependabot の GitHub 側設定・更新頻度・レビュー担当も確認する。更新 PR を自動マージすることは、この導入案には含めない。
第1段階の実行結果を確認してから必須チェックを登録し、第2段階のテストを順次追加する。
