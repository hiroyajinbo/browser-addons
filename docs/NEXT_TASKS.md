# Next Tasks

Last updated: 2026-07-09

## Current Branch

- `mv3-experiment`
- Latest pushed commit: `5ce5aab Fix setup token sync edge case`
- Working tree was clean when this note was written.

## Tomorrow

- Re-test the latest initial setup fix in Firefox:
  - Delete/reload the temporary add-on.
  - Open the options page first.
  - Register the API token from the popup.
  - Confirm the options page reflects the saved token state without manual reload.
  - Confirm folder refresh does not reset the token to unregistered.
- Check the popup setup input spacing after the CSS fix.
- Re-run final static checks:
  - `background.js`
  - `popup.js`
  - `options.js`
  - `manifest.json`
- If the browser check is OK, merge `mv3-experiment` into `main`.

## After Merge

- Push `main`.
- Consider creating a release/tag for the current Firefox build.
- Decide whether to keep `docs/MV3_EXPERIMENT.md` as a historical note or convert it into a browser compatibility note.
- Later: design Chrome/Edge manifest split for `background.service_worker`.

## Known Remaining Manual Checks

- Notification click behavior.
- Color/gray icon switching after unread count changes.
- API token save after a completely fresh install.
- AMO unlisted package contents before signing.
