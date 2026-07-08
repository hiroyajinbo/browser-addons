# Privacy Policy for Fastmail Unread Notifier

Fastmail Unread Notifier is an unofficial browser extension for checking unread mail through the Fastmail API.

## Data Stored Locally

The extension stores the following data in the browser's local extension storage:

- Fastmail API token
- Extension settings
- Selected notification folders
- Last check time
- Cached unread mail metadata for display, such as subject, sender, preview, message ID, and mailbox information
- Popup UI state, such as filters and expanded messages

This data is used only to operate the extension and restore its state.

## Data Sent Outside the Browser

The extension sends data directly to Fastmail API endpoints to provide its features:

- The Fastmail API token is sent to Fastmail for authentication.
- Mailbox, unread mail, message body, and mark-as-read requests are sent to Fastmail.
- Message subjects, senders, previews, and bodies are processed in the browser for display.

The extension does not send API tokens, mail content, addresses, or usage analytics to the developer.

## External Images and Links

External images in HTML mail are disabled by default. If the user enables external images, the browser may request images directly from the image host.

Links in email content open only after user action. The extension does not add tracking parameters.

## Permissions

- `storage`: stores the API token, settings, selected folders, and local display cache.
- `alarms`: performs periodic unread mail checks.
- `notifications`: shows notifications for new unread mail in selected folders.
- `https://api.fastmail.com/*`: communicates with the Fastmail JMAP API.

## Data Deletion

Removing the extension from Firefox removes its local extension storage. The API token can also be cleared by emptying the token field in the options page and saving.

## Affiliation

Fastmail Unread Notifier is not affiliated with, endorsed by, or supported by Fastmail.
