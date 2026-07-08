# Fastmail Masked Email for Firefox

Fastmail の Masked Email 作成を補助するためのローカルFirefox拡張です。

## 目的

- 開いているタブのURLからドメインを補完します。
- 用途名・サイトURL・ドメインを入力して Masked Email 作成を試行します。
- 作成できたアドレスをクリップボードへコピーします。
- 最近作成したアドレスをローカル履歴として保存します。
- Fastmail JMAP session の capability を診断表示します。

## 重要

APIトークンはJMAPを選び、スコープは「マスクドメール」のみONにしてください。メール、メール送信、連絡先などのスコープは不要です。

Masked Email は Fastmail 独自機能のため、設定画面に capability 診断を用意しています。診断で `https://www.fastmail.com/dev/maskedemail` が検出されれば作成機能を使えます。

## Firefoxでの一時インストール

1. Firefox で `about:debugging#/runtime/this-firefox` を開きます。
2. 「一時的なアドオンを読み込む」を押します。
3. このフォルダ内の `manifest.json` を選択します。
4. 拡張機能の設定画面を開きます。
5. Fastmail API token を入力し、「保存して診断」を押します。
6. ツールバーの `Fastmail Masked Email` を開いて作成します。

## AMO Unlistedで署名して自己配布する手順

1. `manifest.json` の `version` を確認します。初回提出は `1.0.0`、更新時は必ず前回より大きいバージョンへ上げます。
2. ZIP化するときは拡張フォルダ自体ではなく、フォルダの中身を圧縮します。ZIPの直下に `manifest.json`、`background.js`、`popup.html` などが来る形にしてください。
3. ZIPには開発用・確認用の不要ファイルを入れません。通常は `manifest.json`、`README.md`、`background.js`、`popup.*`、`options.*` だけを含めます。
4. Mozilla Add-ons Developer Hub で新規アドオンを作成し、配布方法に Unlisted を選んでZIPをアップロードします。
5. 審査・署名が完了したら、署名済みXPIをダウンロードします。
6. Firefox の `about:addons` を開き、歯車メニューから「ファイルからアドオンをインストール」を選んで、署名済みXPIを指定します。

## 権限

- `storage`: APIトークン、診断結果、作成履歴の保存
- `tabs`: 現在のタブURLからドメインを補完
- `clipboardWrite`: 作成したMasked Emailをクリップボードへコピー
- `https://api.fastmail.com/*`: Fastmail JMAP session/APIへの接続

## やらないこと

- メール本文の取得
- Cookie取得
- 履歴取得
- 購入履歴取得
- Fastmail以外の外部サービスへの通信
