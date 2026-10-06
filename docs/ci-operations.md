# CI・依存関係の運用

## GitHub Actions

`.github/workflows/ci.yml` は main 向け PR・main push・手動実行で次の3ジョブを実行する。

| チェック名 | 内容 |
| --- | --- |
| Verify | lockfile インストール、lint、Next.js 型生成と型検査、単体/API、ダミー環境でのビルド、Chromium E2E |
| Dependency security | 監査判定のテスト、本番依存・開発依存を含む全依存の脆弱性監査、JSON 証跡保存 |
| Firebase SDK smoke | 固定版 Firebase CLI と Java 21、Auth/Firestore/Storage emulator による SDK 互換性・Rules 拒否確認 |

毎週月曜07:00 JST の定期実行は `Dependency security` のみ。定期実行と手動実行はワークフローが main に取り込まれてから使用できる。
権限は `contents: read`。Actions の参照はコミット SHA 固定、Node は24系、Firebase CLI は15.17.0固定。
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
