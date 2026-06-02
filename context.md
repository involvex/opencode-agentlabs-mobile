# OpenCode Mobile — Ownership Context

App: `cc.agentlabs.opencode` (OpenCode Mobile). Expo/React Native Android client
for a user self-hosted opencode AI coding server. Owner: VIBE TECHNOLOGIES, LLC.

## GOAL (verbatim)
1. No bugs — opencode mobile works end to end.
2. Publish on F-Droid (if not).
3. Publish on Google Play (if not).
4. Use App-Store-Optimization + growth-hacking skills to optimize store listings.
5. Reach 1k downloads.
6. Keep goal/design/plan/progress in this file.

Success = published + functional on BOTH stores AND 1k verified downloads.

## DESIGN / ARCHITECTURE NOTES
- Sessions list reads home-scoped (`session.list({roots:true})` via
  `clientForDirectory(serverHome)`) when connection has no explicit directory.
  Create must use the SAME scope or new sessions are invisible (bug #10).
- CUA smoke test = Android emulator + vision-LLM driving the app, with a real
  opencode server on the runner host (10.0.2.2:4096). This is the E2E gate.
- Telemetry (Sentry) is opt-in, default OFF.

## CURRENT STATE (2026-06-01)
- tsc: clean. Build APK CI: green. No open PRs.
- v0.4.2 APK public (GitHub release). Play: Draft, blocked on human App-content
  console declarations (answers pre-drafted in distribution/PLAY-APP-CONTENT-ANSWERS.md).
- F-Droid: mainline MR #39530 filed (real path); self-hosted repo deprioritized
  (androguard v2+v3 dup-signature bug).
- BUG #10 (sessions empty after connect/create): fix committed a536466. Pre-fix
  smoke (run 26786055765) reproduced it exactly. Fix smoke run cancelled (server
  install hang) → **UNVERIFIED**. Re-verifying now.
- Version mismatch: package.json 0.4.2 vs android/app/build.gradle versionName 0.4.1.

## PLAN
- [ ] P1 Verify #10 fix via re-dispatched CUA smoke (E2E green).
- [ ] P1 Reconcile version (package.json vs gradle) — pick single source of truth.
- [ ] P2 Scan for other E2E bugs (connect/create/send/abort scopes).
- [ ] P3 Play: human completes App-content + production rollout (gated).
- [ ] P3 F-Droid: track MR #39530 (gated on maintainer review).
- [ ] P4 ASO: refine listing copy/keywords with ASO skill.
- [ ] P4 Growth: execute launch posts in distribution/launch/ for downloads.

## PROGRESS LOG
- 2026-06-01: Resumed under /take-ownership. tsc clean, build green.
  Confirmed #10 is a real reproduced bug; fix logic verified sound (create+list
  share home scope). Spotted version mismatch. Wrote this file.
- 2026-06-01: Fixed gradle versionName 0.4.1→0.4.2 (commit 0615ab8).
- 2026-06-01: Refactored #10 scope rule into one pure helper sessionScopeDirectory()
  so list/create can't drift; added node:test regression guard (4/4 pass), `npm test`
  script, excluded tests from app tsc (commit bed0b6f).
- 2026-06-01: Found + fixed a SECOND scope bug (commit 66b89f7): freshly created
  home-scoped session was opened/sent via default CWD client because nav carried no
  directory param. createSession now stamps scope dir onto session; create-nav passes
  it. Same root cause as #10, open/send path. tsc + tests green.
- 2026-06-01: Smoke running on 66b89f7 (run 26803479355) — verifies connect→create→
  list visibility. Awaiting verdict.
- ASO/growth assets already authored (distribution/: aso-audit, listings, launch kit,
  graphics). Blocker is EXECUTION (human Play console publish + posting from owner
  accounts), not content.

## WHAT ONLY THE HUMAN OWNER CAN DO (gated)
- Play Console: complete App content declarations + production rollout (answers in
  distribution/PLAY-APP-CONTENT-ANSWERS.md). No admin/API access from here.
- F-Droid: respond to mainline MR #39530 maintainer review.
- Growth: post launch content from real accounts (HN/PH/Reddit/X) to drive installs.
- These are why "published on both stores + 1k downloads" cannot be closed by the agent.
