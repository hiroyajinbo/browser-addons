# AMO Unlisted Preparation: Fastmail Checker

This note tracks the Firefox AMO Unlisted submission package for Fastmail Checker.

## Version

- Extension: `fastmail-checker-firefox`
- Version: `1.0.0`
- Add-on ID: `fastmail-checker@hiroyajinbo.github.io`
- Tag: `fastmail-checker-firefox-v1.0.0`
- Upload ZIP: `dist/fastmail-checker-firefox-1.0.0.zip`

## Package Contents

The ZIP should contain the extension files at the archive root, not a parent directory.

```text
manifest.json
README.md
background.js
popup.html
popup.js
popup.css
options.html
options.js
options.css
icon-48.png
icon-96.png
icon-128.png
icon-gray-48.png
icon-gray-96.png
icon-gray-128.png
```

## AMO Notes

- Distribution: Unlisted
- Category suggestion: Productivity
- Support policy: no guaranteed support
- Privacy policy: use repository `PRIVACY.md`
- Security/support policy: use repository `SECURITY.md` and `SUPPORT.md`

## Permission Rationale

- `storage`: stores API token and user settings locally in the browser.
- `alarms`: checks unread mail periodically.
- `notifications`: shows desktop notifications for new unread mail in notification target folders.
- Host permission `https://api.fastmail.com/*`: calls the Fastmail JMAP API.

## Manual Checks Before Upload

- Load the ZIP with `about:debugging`.
- Confirm the popup opens.
- Confirm the options page opens.
- Confirm API token setup works from a fresh install.
- Confirm unread badge and gray/color icon switching.
- Confirm external image loading remains OFF by default.
