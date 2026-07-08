# アーキテクチャ概要

このリポジトリは、複数のブラウザ拡張機能をまとめて管理するモノレポです。

## 構成

```text
browser-addons/
  fastmail-checker-firefox/
  fastmail-masked-email-firefox/
  rakuten-kobo-sale/
  rakuten-top-cleaner/
  docs/
```

## 基本構造

各拡張機能は、WebExtension形式で構成されています。

- `manifest.json`: 拡張機能の定義、権限、UI、バックグラウンド処理の設定
- `background.js`: API通信、定期処理、通知、ストレージ操作など
- `popup.html` / `popup.css` / `popup.js`: ツールバーから開くUI
- `options.html` / `options.css` / `options.js`: 設定画面
- `src/content/`: Webページへ注入するcontent script
- `assets/`: アイコンなどの静的ファイル

拡張機能によって、存在しないファイルやディレクトリがあります。

## Fastmail Checker

Fastmail APIを利用して、未読メール確認、通知、メール本文表示、既読化を行います。

主な処理:

- APIトークンをローカルストレージへ保存
- Fastmail JMAP sessionを取得
- メールボックス一覧を取得
- 対象メールボックスの未読メールを取得
- バッジとツールバーアイコンを更新
- 必要に応じて通知を表示
- ポップアップでメール本文を取得して表示
- HTMLメールはサニタイズして表示

## Fastmail Masked Email

Fastmail APIを利用して、Masked Emailの作成を補助します。

主な処理:

- 現在のタブURLからドメインを推定
- 説明、URL、ドメインを入力
- Fastmail APIでMasked Emailを作成
- 作成したアドレスをクリップボードへコピー
- 作成履歴をローカルに保存

## 楽天系拡張

楽天関連ページの表示調整やセール確認を補助する拡張機能です。

Fastmail系とは独立しており、必要に応じてcontent scriptやpopup UIを使います。

## データ保存

各拡張機能は `browser.storage.local` を利用します。原則として、データはユーザーのブラウザ内に保存されます。

## 今後の設計方針

- 共通化できる処理は `shared/` へ切り出すことを検討する
- Manifest V3対応を見据えて、background scriptの永続状態依存を減らす
- HTMLメール表示、外部画像表示、APIトークン管理は安全側に倒す
- Firefox、Chrome、Edgeの差分を吸収できる構成を検討する
