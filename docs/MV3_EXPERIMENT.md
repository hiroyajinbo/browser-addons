# Manifest V3 experiment

このブランチでは、まず `fastmail-checker-firefox` のみManifest V3化を試します。

## 変更内容

- `manifest_version` を `3` に変更
- `background.scripts` を `background.service_worker` に変更
- `browser_action` を `action` に変更
- `https://api.fastmail.com/*` を `host_permissions` に分離
- Firefox向け設定を `applications` から `browser_specific_settings` に変更
- `background.js` / `popup.js` / `options.js` に `browser` / `chrome` の薄い互換参照を追加
- ツールバーAPIを `browser.action` 優先に変更

## 確認済み

- `background.js` の構文チェック
- `popup.js` の構文チェック
- `options.js` の構文チェック
- `manifest.json` のJSON parse
- `browserAction` などManifest V2固有参照が残っていないこと

## 未確認

- Firefoxでの実読み込み
- Chrome/Edgeでの実読み込み
- service worker停止後の定期チェック復帰
- 通知クリック、バッジ、アイコン切り替え
- API token保存後の初回チェック

## 注意

このブランチは試作用です。Firefox MV2版を置き換える前に、実ブラウザでの動作確認とChrome/Edge差分の確認が必要です。
