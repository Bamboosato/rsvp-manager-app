# LINE登録コード方式 設計メモ

## 方針

LINEのfollow eventには紹介元パラメータが含まれないため、RSVP Hubでは登録コード送信方式で管理者アカウントとLINE userIdを紐づける。

管理者ごとに登録コードを発行し、LINE URL schemeの `oaMessage` URLで登録コードを入力欄にセットする。ユーザーはLINEの送信ボタンを押し、Webhookのmessage eventで登録コードを受け取る。

LINE公式アカウントの友だち追加時あいさつメッセージには、最後に `表示された登録コードをそのまま送信してください！` を表示する。これに合わせ、入力欄へセットする文言は `登録 {code}` ではなく `{code}` のみとする。

## 主なデータ

- `lineRegistrationCodes/{code}`: 登録コードから `ownerUid` を解決するサーバー専用データ
- `lineRegistrationCodeOwners/{lineAccountId_ownerUid}`: 管理者ごとの現行コード
- `lineFriends/{friendId}`: 管理者ごとのLINE友だち、メモ、配信対象、LINE userId、画像URL
- `lineMessageDeliveries/{deliveryId}`: LINE配信結果ログ

## Webhook

- URL: `/api/line/webhook/{lineAccountId}`
- 既定URL: `/api/line/webhook/default`
- `x-line-signature` を検証する
- text messageから登録コード単体を解析する
- 既存案内との互換性のため、`登録 {code}` 形式も解析する
- 登録成功時はLINEプロフィールを取得し、画像はFirebase Storageへ保存する
- 登録成功/失敗をreply messageで返す
- unfollow eventでは該当LINE userIdを配信対象外にする

## テスト観点

### 機能観点

- 管理者ごとに登録コードが発行される
- LINE登録用URL/QRコードが表示される
- 正しい登録コードのmessage eventでLINE友だちが登録される
- 誤った登録コードでは登録されない
- 配信用URLのイベント選択とLINE友だち選択からpush messageが送信される
- LINE配信の挨拶文欄は `{プラン名} の出欠確認です。` と `以下のURLから出欠を入力してください。` を初期表示し、管理者が編集した内容を送信本文として扱う
- LINE配信時は、挨拶文欄の編集後本文の末尾に配信用URLを付与して送信する

### 非機能観点

- LINE API失敗時もWebhookは再調査可能なログを残す
- 画像取得/Storage保存に失敗しても友だち登録自体は失敗させない
- Webhook再送でも同じ友だちが重複作成されない
- 低速回線でも管理画面が送信中/失敗を表示する

### データ観点

- 同じLINE userIdが同じ管理者に再登録される
- 同じLINE userIdが別管理者のコードでも登録される
- 画像なしプロフィール
- 長いメモ
- ブロック済み/配信対象外の友だち

### UI観点

- スマホ幅でQR、友だち一覧、LINE配信モーダルが崩れない
- 送信先0件、イベント0件で配信ボタンが無効になる
- 成功件数/失敗件数が管理者に表示される
