# AMO Unlisted Preparation: Fastmail Unread Notifier

This note tracks the Firefox AMO Unlisted submission package for Fastmail Unread Notifier.

## Version

- Extension: `fastmail-checker-firefox`
- AMO name: `Fastmail Unread Notifier`
- Version: `1.0.3`
- Add-on ID: `fastmail-unread-notifier@hiroyajinbo.github.io`
- Tag: `fastmail-checker-firefox-v1.0.3`
- Upload ZIP: `dist/fastmail-checker-firefox-1.0.3.zip`
- Do not upload the older `1.0.0`, `1.0.1`, or `1.0.2` ZIP/tag. They were created before the final AMO naming, data collection manifest, or validation updates.

## Package Contents

The ZIP should contain the extension files at the archive root, not a parent directory.

```text
manifest.json
README.md
PRIVACY.md
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
- Privacy policy: use `fastmail-checker-firefox/PRIVACY.md`
- Security/support policy: use repository `SECURITY.md` and `SUPPORT.md`
- This extension is unofficial and is not affiliated with, endorsed by, or supported by Fastmail.
- Reviewer note: a Fastmail account and user-created API token are required for full runtime testing. The developer cannot provide a Fastmail account or token to reviewers.
- Suggested review approach if runtime credentials are unavailable: source review plus temporary-install validation of popup/options UI.

## Permission Rationale

- `storage`: stores the API token, settings, selected folders, local unread-mail display cache, and popup UI state locally in the browser.
- `alarms`: checks unread mail periodically. The interval is user-configurable from 1 to 60 minutes.
- `notifications`: shows desktop notifications for new unread mail in notification target folders. If detailed notifications are enabled, the notification can include subject, sender, and preview.
- Host permission `https://api.fastmail.com/*`: calls the Fastmail JMAP API for session discovery, mailbox listing, unread mail retrieval, message body retrieval, and mark-as-read updates.

## Data Collection Permission Rationale

`browser_specific_settings.gecko.data_collection_permissions.required` includes:

- `authenticationInfo`: the user-provided Fastmail API token is sent to Fastmail API endpoints for authentication.
- `personalCommunications`: email subjects, senders, previews, message bodies, mailbox metadata, and read/unread state are requested from Fastmail and displayed locally.

The extension does not send this data to the developer, analytics services, advertising services, or any developer-operated server.

External images in HTML email are disabled by default. If enabled by the user, the browser may request image URLs directly from the image host.

## Manual Checks Before Upload

- Load the ZIP with `about:debugging`.
- Confirm the popup opens.
- Confirm the options page opens.
- Confirm API token setup works from a fresh install.
- Confirm unread badge and gray/color icon switching.
- Confirm external image loading remains OFF by default.
