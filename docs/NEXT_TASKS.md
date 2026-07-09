# Next Tasks

Last updated: 2026-07-09

## Current State

- Branch: `main`
- Firefox MV3 work has been merged into `main`.
- Fastmail Unread Notifier `1.0.3` has been approved by AMO as an Unlisted add-on.
- Signed XPI has been installed locally and core behavior has been smoke-tested.
- GitHub Release has been published: https://github.com/hiroyajinbo/browser-addons/releases/tag/fastmail-checker-firefox-v1.0.3
- Chrome/Edge manifest split is intentionally deferred until after several days of Firefox use.

## Next

- Use the signed Firefox XPI for several days in normal mail-checking workflow.
- Confirm HTML email display ON/OFF with real HTML mail.
- Confirm external image loading remains OFF by default with real HTML mail.
- Record any issues found during daily use before planning `1.0.4`.

## Later

- Decide whether to keep `docs/MV3_EXPERIMENT.md` as a historical note or convert it into a browser compatibility note.
- Design Chrome/Edge manifest split for `background.service_worker`.

## Known Remaining Manual Checks

- HTML email rendering with real messages.
- External image loading OFF default with real messages.
- Update flow from the signed XPI to a future signed version.
