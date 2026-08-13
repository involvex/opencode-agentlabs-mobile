# Update build docs for private fork / no-EAS workflow

## Goal
Update project docs to reflect that this is a private fork with no EAS / store release planned, and document the correct local release build command.

## Current state
- `README.md` mentions EAS Build in the Supporters/Sponsors section
- `docs/market.md` references EAS Build in revenue/cost model, risk table, and decision log
- No doc currently documents the local release build command (`npx expo run:android --variant release`) for developers who don't use EAS

## Plan

### 1. Update README.md
- Replace the EAS Build mention in the Supporters/Sponsors section with a note that builds are done locally via `npx expo run:android --variant release`
- Keep the GitHub Sponsors mention (still relevant for Sentry/CI costs)

### 2. Add local build docs
- Add a "Building" section to README.md (or update an existing one) documenting:
  - Dev build: `npx expo run:android`
  - Release build: `npx expo run:android --variant release`
  - Note: no EAS / store upload involved; this is a private fork

### 3. Update docs/market.md
- Remove or update EAS Build references to reflect current reality (private fork, no EAS)
- Remove the "EAS Build for iOS CI" decision from the decision log, or annotate it as superseded

### 4. Commit
- Stage the changed docs and commit with a clear message

## Validation
- Verify README renders correctly (no broken links)
- Confirm no remaining EAS references that would confuse contributors about the build process

## Files touched
- `README.md`
- `docs/market.md`
