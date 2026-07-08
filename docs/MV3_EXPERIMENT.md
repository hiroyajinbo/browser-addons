# Manifest V3 experiment

このブランチでは、まず `fastmail-checker-firefox` のみManifest V3化を試します。

## 変更内容

- `manifest_version` を `3` に変更
- Firefoxの現在の読み込み環境に合わせて `background.scripts` を維持
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
- Chrome/Edge向けに `background.service_worker` を使う別manifestまたはビルド分岐
- 通知クリック、バッジ、アイコン切り替え
- API token保存後の初回チェック

## 注意

このブランチは試作用です。Firefoxでは `background.service_worker` が無効な環境があるため、現時点ではFirefox向けMV3として `background.scripts` を使います。Chrome/Edge向けに配布する場合は `background.service_worker` を使うmanifest差分かビルド分岐が必要です。
