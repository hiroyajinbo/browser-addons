# Fastmail Unread Notifier for Firefox

Fastmail の未読メールを Firefox のツールバーバッジとデスクトップ通知で確認するためのローカル拡張です。

## ダウンロード

署名済みXPIは GitHub Releases からダウンロードできます。

- [Fastmail Unread Notifier v1.0.3](https://github.com/hiroyajinbo/browser-addons/releases/tag/fastmail-checker-firefox-v1.0.3)

## 入っている機能

- Fastmail API token / JMAP で接続
- 通知対象フォルダの ON/OFF
- ツールバーバッジに通知対象フォルダの未読数を表示
- 新着未読メールのデスクトップ通知
- ポップアップで未読メール一覧を表示（通知対象外フォルダの未読も確認可能）
- 件名・差出人・宛先・フォルダ名で表示フィルタ
- フォルダ別の表示フィルタ
- 1件ずつ既読化
- 表示中メールのまとめて既読化
- HTMLメールの整形表示ON/OFF
- HTMLメール内の外部画像読み込みON/OFF
- Fastmail Web へのショートカット

## APIトークンの目安

Fastmail Settings → Security → API tokens からトークンを作成します。

- 未読確認・通知・一覧表示だけ: read-only 系の権限で運用
- 既読化も使う: JMAP mail / Email の変更ができる権限が必要
- メール送信権限は不要

APIトークンはアカウントにアクセスできる鍵なので、必要最小限の権限にしてください。

## Firefoxでの一時インストール

1. このフォルダを任意の場所に展開します。
2. Firefox で `about:debugging#/runtime/this-firefox` を開きます。
3. 「一時的なアドオンを読み込む」を押します。
4. 展開したフォルダ内の `manifest.json` を選択します。
5. ツールバーの Fastmail Unread Notifier アイコン、または拡張機能の設定画面から API トークンを保存します。

一時インストールなので、Firefoxを再起動すると読み込み直しが必要になる場合があります。常用する場合は、署名済みアドオン化や自分用の開発者版運用を検討してください。

## 署名済みXPIのインストール

1. GitHub Releases から `fastmail-unread-notifier-firefox-1.0.3.xpi` をダウンロードします。
2. Firefox の `about:addons` を開きます。
3. 歯車メニューから「ファイルからアドオンをインストール」を選びます。
4. ダウンロードしたXPIを指定します。

## AMO Unlistedで署名して自己配布する手順

1. `manifest.json` の `version` を確認します。現在のAMO提出候補は `1.0.3` です。更新時は必ず前回より大きいバージョンへ上げます。
2. ZIP化するときは拡張フォルダ自体ではなく、フォルダの中身を圧縮します。ZIPの直下に `manifest.json`、`background.js`、`popup.html` などが来る形にしてください。
3. ZIPには開発用・確認用の不要ファイルを入れません。通常は `manifest.json`、`README.md`、`background.js`、`popup.*`、`options.*`、`icon-*.png` だけを含めます。
4. Mozilla Add-ons Developer Hub で新規アドオンを作成し、配布方法に Unlisted を選んでZIPをアップロードします。
5. 審査・署名が完了したら、署名済みXPIをダウンロードします。
6. Firefox の `about:addons` を開き、歯車メニューから「ファイルからアドオンをインストール」を選んで、署名済みXPIを指定します。

## 使い方

1. 設定画面で Fastmail API token を入力します。
2. 「保存」を押します。
3. フォルダ一覧が取得されたら、通知対象にしたいフォルダをONにします。
4. 通知・表示、通知対象フォルダの変更は自動保存されます。
5. ツールバーアイコンに通知対象フォルダの未読数が出ます。

## 注意点

- 初回チェック時は、既存の未読メールを大量通知しないように「既知の未読」として登録します。
- 以後、通知対象フォルダ内で新しく見つかった未読メールだけ通知します。
- バッジ件数は通知対象フォルダのみを数えます。ポップアップでは、通知対象外フォルダの未読メールも確認できます。
- 通知対象フォルダをすべてOFFにすると、バッジ件数と通知は0件扱いになります。
- Firefoxが起動していない間は通知されません。
- 既読化が失敗する場合は、APIトークンが read-only の可能性があります。
- 外部画像をONにすると、画像配信元へアクセスが発生する場合があります。公開・配布版ではOFF運用を推奨します。
- Fastmail のWeb UIで作った受信ルール名そのものの表示はしていません。代わりに、フォルダ名・差出人ドメイン・宛先情報をチップ表示します。
- Cookie、履歴、購入履歴、Fastmail以外の外部サービスへの通信は行いません。

## ファイル構成

```text
manifest.json
README.md / PRIVACY.md
background.js
popup.html / popup.js / popup.css
options.html / options.js / options.css
icon-48.png / icon-96.png / icon-128.png
icon-gray-48.png / icon-gray-96.png / icon-gray-128.png
```
