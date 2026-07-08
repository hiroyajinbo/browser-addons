# Next Tasks

Last updated: 2026-07-09

## Current State

- Branch: `main`
- Firefox MV3 work has been merged into `main`.
- Chrome/Edge manifest split is intentionally deferred until after the Firefox release flow.

## Next

- Prepare AMO Unlisted ZIP for Fastmail Unread Notifier `1.0.2`.
- Create release tag for `fastmail-checker-firefox` `1.0.2`.
- Upload ZIP to AMO as Unlisted and download the signed XPI.
- Install the signed XPI locally and confirm settings persist.

## After Merge

- Decide whether to keep `docs/MV3_EXPERIMENT.md` as a historical note or convert it into a browser compatibility note.
- Later: design Chrome/Edge manifest split for `background.service_worker`.

## Known Remaining Manual Checks

- AMO unlisted package contents before signing.
- Signed XPI install from file.
- Update flow from temporary/local install to signed XPI.
