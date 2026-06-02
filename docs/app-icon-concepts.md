# RSVP Hub App Icon Concepts

## 方針

- 業務アプリ寄りの落ち着いた印象にする。
- 白、グレー、アクセントブルーを中心にする。
- 小さなブラウザタブやスマホホーム画面でも認識できる単純な形にする。
- `RSVP` の文字を入れ、アプリ名との結びつきが分かるようにする。
- 文字は小さいサイズでも読めるよう、太めで単純な字形にする。

## 案

### 案1: RSVP Hub Nodes

ファイル: `public/icons/rsvp-hub-rsvp-concept-1.svg`

`RSVP` の下に回答ノードを配置した構成。アプリ名と「複数の回答がHubに集まる」意味を両方伝えやすい。

軽量フレーム版: `public/icons/rsvp-hub-rsvp-concept-1-light-frame.svg`

### 案2: RSVP Dashboard

ファイル: `public/icons/rsvp-hub-rsvp-concept-2.svg`

青い見出し領域に `RSVP` を置き、下に出欠の集計タイルを配置した構成。管理画面、集計、イベント一覧を連想しやすい。

軽量フレーム版: `public/icons/rsvp-hub-rsvp-concept-2-light-frame.svg`

### 案3: RSVP Wordmark

ファイル: `public/icons/rsvp-hub-rsvp-concept-3.svg`

`RSVP` を最も大きく見せる構成。ブラウザタブや小さなホーム画面アイコンでも読ませやすい。

## 比較用の文字なし案

- `public/icons/rsvp-hub-concept-1.svg`
- `public/icons/rsvp-hub-concept-2.svg`
- `public/icons/rsvp-hub-concept-3.svg`

## 推奨

MVPでは **案1: RSVP Hub Nodes** を推奨する。理由は、`RSVP` の文字を見せつつ、「複数の予定・回答が1つに集まる」意味も表現できるため。

## 仮採用

案1の軽量フレーム版を仮採用する。

- 採用元: `public/icons/rsvp-hub-rsvp-concept-1-light-frame.svg`
- 実装用ファイル: `public/icons/rsvp-hub-icon.svg`
- ブラウザタブ用アイコン: `src/app/layout.tsx` の metadata icons で `public/icons/rsvp-hub-icon.svg` を参照する。
