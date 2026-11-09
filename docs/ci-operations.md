# CI・依存関係の運用

## GitHub Actions

`.github/workflows/ci.yml` は main 向け PR・main push・手動実行で次の3ジョブを実行する。

| チェック名 | 内容 |
| --- | --- |
| Verify | lockfile インストール、lint、Next.js 型生成と型検査、単体/API、ダミー環境でのビルド、Chromium E2E |
| Dependency security | 監査判定のテスト、本番依存・開発依存を含む全依存の脆弱性監査、JSON 証跡保存 |
| Firebase SDK smoke | 固定版 Firebase CLI と Java 21、Auth/Firestore/Storage emulator による SDK 互換性・Rules 拒否確認 |

毎週月曜07:00 JST の定期実行は `Dependency security` のみ。定期実行と手動実行はワークフローが main に取り込まれてから使用できる。
権限は `contents: read`。Actions の参照はコミット SHA 固定、Node は24系、npm は11.19.0、Firebase CLI は15.17.0固定。
実行ログに Node/npm/Java の実際の版を残す。ダミー Firebase 値を使用し、管理秘密鍵・LINE アクセストークンを要求しない。
Dependabot は npm と Actions の週次更新 PR を作成する。GitHub の自動セキュリティ修正も確認時点で有効。自動マージは設定しない。

## 監査の合否

`npm run audit:security` は本番依存の検出を重大度にかかわらず失敗させる。
全依存は `--include=dev` を明示し、ローカルの production/omit 設定で開発依存が監査から落ちないようにする。
開発依存は `security-audit-exception.json` の対象名・lockfile node・版・アドバイザリ・将来の期限に一致する場合のみ許可する。critical、本番への移動、新規アドバイザリ、期限到達は失敗する。
例外を更新する場合は根拠をレビューし、期限やバージョンを自動で延長しない。修正が公開されたら依存更新と例外削除を同じ PR で行う。
監査の通信失敗、実行エラー、不正 JSON、件数不整合も失敗する。CI は `npm audit fix` を実行しない。

## 初回の依存更新と期限付き例外

2026-10-06 の導入前 main (`a72e934`) では、本番依存6件、全依存11件を検出した。
次の override を追加し、本番依存の指摘を解消した。いずれも直接依存の Firebase/Next.js の版を変更しない。

- `@grpc/grpc-js: 1.14.5`: Firebase Web SDK が要求する古い1.9系を修正版へ置き換える。[grpc アドバイザリ](https://github.com/advisories/GHSA-m9gg-hp2v-232j)、[エラー漏えいアドバイザリ](https://github.com/advisories/GHSA-f596-whhp-79r4)
- `gaxios@6.7.1` の `uuid: 11.1.1`: Storage 経由の uuid 9 を修正版へ置き換える。互換性は Storage upload/download で検証する。[uuid アドバイザリ](https://github.com/advisories/GHSA-w5hq-g745-h8pq)

残る指摘は [`GHSA-vfj7-8cjw-p6xm`](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) の開発依存5件。2026-10-06時点で修正版は公開されていない。
RSVP Hub の lockfile で個別確認した次の版だけを、2026-11-05 00:00 UTC（同日09:00 JST）まで例外とした。

| パッケージ | 版 |
| --- | --- |
| braces | 3.0.3 |
| micromatch | 4.0.8 |
| fast-glob | 3.3.1 |
| @next/eslint-plugin-next | 16.3.6 |
| eslint-config-next | 16.3.6 |

これらは開発用 glob/lint 経路で、アプリの利用者から渡されたパターンを処理する本番依存には含まれない。期限まで週次監査で修正状況を確認する。
PR のファイルやパターンは信頼済みとは限らないため、CI は読み取り権限と秘密情報を持たない runner で実行し、タイムアウトも設定する。
「本番0件・全依存5件を限定例外で許可」と「全依存0件」は異なる状態である。日時・版が変われば監査結果も変わり得る。

## ローカル確認と未検証範囲

前提、テスト観点、コマンド、証跡、E2E の選定理由は [tests/README.md](../tests/README.md) を参照する。
CI 用ビルドは `npm run build:ci`、本番用ビルドは通常の `npm run build` を使う。ダミー環境で作った `.next` を本番へ転用しない。
エミュレーターは実サービスの IAM や秘密鍵、FCM、LINE 実送信を検証しない。APIモックを用いた E2E は Firestore 永続化までの通し試験ではない。

## 必須チェック

導入 PR の正常実行を確認してから、main の保護設定に `Verify`、`Dependency security`、`Firebase SDK smoke` を GitHub Actions の必須チェックとして登録する。
既存の保護やチェックがある場合は保持し、最新 main への追従を要求する。設定状態と実行結果は導入完了時に記録する。
ワークフローを含まない古い PR は、この CI を含む main に追従してから再検証する必要がある。

## 2026-11-02 の監査修正

React 19.3.1 / React DOM 19.3.1 の更新に加え、監査の循環参照処理と新たな依存脆弱性を修正した。

- npm audit の `via` は ESLint とその peer 依存の間で循環する場合がある。各起点から到達可能なノードを一度ずつ探索し、すべての直接アドバイザリを集める。根拠のない循環、欠損参照、不正 URL・重大度・件数は引き続き失敗する。本番依存は例外で許可しない。
- `glob` を14.0.2へ固定し、[GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) の修正版を使う。`rimraf` のファイル削除と glob の検索・中断拒否を検証した。
- `minimatch` の9/10系を11.0.1へ置き換え、[GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) に対応する。名前付き API を使う glob / TypeScript ESLint の経路が対象。旧 callable CommonJS API を必要とする3系は一括置換しない。
- 本番依存の検出は6件から0件へ減少した。全依存の検出15件は開発用 ESLint 経路の minimatch 3.1.5 と、その影響を受けるラッパーである。パッケージ名・lockfile node・版・GHSA を個別に固定した期限付き例外として記録する。アドバイザリの影響範囲は3系も含むため、脆弱性0件とは扱わない。

3.1.5 の実装には、当該アドバイザリが説明する `optimizationLevel >= 2` の `firstPhasePreProcess` / `secondPhasePreProcess` 処理がないことを確認した。ただし、PR の設定・パスも信頼済みとは限らず、lint のリソース消費リスクを否定するものではない。既存の読み取り権限・アプリ秘密情報なし・ジョブタイムアウトを維持する。

従来の braces 用例外は今回の監査結果には含まれず、現行の個別評価へ置き換えた。期限は従来どおり **2026-11-05 00:00 UTC（09:00 JST）**。延長していない。期限到達・新しい GHSA・対象版や経路の変更・本番への移動は再び監査を失敗させる。期限前に互換性を保つ上流の更新を再確認し、解消した例外を削除する。


## 2026-11-09 の期限切れ例外整理

[同日の定期監査](https://github.com/Bamboosato/rsvp-manager-app/actions/runs/42545361805) の保存結果は、本番・開発依存込みの両方で検出0件だった。一方、11月5日に失効した例外15件の検証によりゲートが失敗した。
[GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) の更新後の影響範囲は `>=7.0.0 <11.0.1` で、現行 lockfile の minimatch 3.1.5 は対象外、11.0.1 は修正版である。このため旧例外15件を削除し、`version: 1` と空の `entries` を維持する。上記11月2日の記述は当時の判断履歴であり、現在の検出件数ではない。

期限の延長、依存版の変更、監査ルールの緩和は行わない。今後の新規検出や監査通信エラーは従来どおり失敗させる。0件は確認時点の依存監査結果であり、アプリ全体の安全性を保証するものではない。
