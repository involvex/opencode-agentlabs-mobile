# OpenCode Mobile — Handoff (2026-06-02)

App: **`cc.agentlabs.opencode`** (OpenCode Mobile) — Expo/React Native Android client
for a user self-hosted opencode AI server. Owner: VIBE TECHNOLOGIES, LLC.
Repo: `dzianisv/opencode-mobile`. Full running log: `context.md`.
Goal: bug-free E2E + published on F-Droid & Play + 1k downloads.

---

## TL;DR status

| Goal | State |
|---|---|
| #1 App works E2E, no bugs | ✅ **Done & verified** (CUA smoke green; 4 bugs fixed) |
| #2 F-Droid published | ✅ self-hosted repo **LIVE @ v0.4.3** (verified 2026-06-02 via index-v1.json) |
| #3 Google Play published | 🟡 **internal track live** (v0.4.3); production needs owner console step |
| #4 Store optimization (ASO) | ✅ assets authored in `distribution/` |
| #5 1k downloads | ❌ needs public listings + growth posting (owner) |

---

## App URLs

- **Direct APK (works now):** https://github.com/dzianisv/opencode-mobile/releases/latest
- **F-Droid self-hosted repo:** https://dzianisv.github.io/opencode-mobile/fdroid/repo
  (add this URL in any F-Droid client). **LIVE @ v0.4.3** — verified 2026-06-02.
- **Google Play (NOT public yet):** https://play.google.com/store/apps/details?id=cc.agentlabs.opencode
  — 404s until production rollout; internal-testing track has v0.4.3.
- **F-Droid mainline (pending MR #39530):** https://f-droid.org/packages/cc.agentlabs.opencode/

---

## What was done this session (committed to `main`)

**Bug fixes (goal #1) — `npm run typecheck` + `npm test` green, E2E smoke verified:**
- `0615ab8` gradle versionName 0.4.1→0.4.2 (stale vs app.json)
- `bed0b6f` #10 root cause: single `src/stores/sessionScope.ts` helper so session
  list/create scopes can't drift; `node:test` regression guard + `npm test` script
- `66b89f7` 2nd scope bug: created session opened/sent via wrong client (nav lacked
  `directory`); now stamped on the session + passed through
- `059b5cc` send-failure after a session switch flashed error on / refetched the
  wrong session
- Full runtime audit (dismissed 2 false-positives with evidence).
- **CUA smoke GREEN** (run 26803479355): connect→create→list passes (was the #10 repro).

**Publishing (goals #2/#3):**
- `c66f4fb` cut **v0.4.3** (versionCode 5).
- `eea84a3` **F-Droid publish fix**: pin `androguard==4.1.3` (the `==4.1.4` pin added
  2026-06-01 crashed in `parse_v2_v3_signature`) + apksigner v1+v2-only re-sign step in
  `publish-fdroid.yml`. **Verified locally** that 4.1.3 parses the APK signer cert.
- Tag `v0.4.3` re-pointed → re-runs the F-Droid publish (in flight at handoff).
- Play **internal track** auto-published v0.4.3 via `publish-play-store.yml` (success).
- `67773fc` corrected IzzyOnDroid doc (was stale `ai.opencode.mobile`).

---

## OWNER ACTIONS REQUIRED — only these unblock #2/#3/#5 (agent cannot do them)

0. **Push the local commits (push is permission-gated for the agent).**
   **13 commits unpushed on `main`** as of 2026-06-08 (run `git log origin/main..main --oneline`
   to confirm). All reach ZERO users until pushed — this is the dominant growth bottleneck.
   Highlights: SEO pages `/features/`, `/download/`, `/troubleshooting/`, `/comparison/`,
   `/vs-termux/`, `/claude-code-android/`; landing screenshot strip; README non-affiliation note;
   CI typecheck+tests; test coverage 4→65; session-scope fix `ee7082a`.
   Step: `source ~/.env.d/github-dzianisv.env && git push origin main`.
   Pushing `main` (no tag) only redeploys GitHub Pages + runs CI — safe, no release fired.
   The session-scope fix is not yet in any release. To ship it, bump the version in
   BOTH `app.json` (line 5: `"version": "0.4.3"` → `"0.4.4"`) and
   `android/app/build.gradle` (line 98 `versionName "0.4.3"` → `"0.4.4"`; leave
   `versionCode` — Play's is auto-set to `github.run_number`, F-Droid reads versionName),
   commit, then `git tag v0.4.4 && git push origin main --tags`. The `v*` tag fires
   `publish-fdroid.yml` and `publish-play-store.yml` automatically.

1. **Privacy policy is live (Play-production blocker cleared).** Canonical privacy URL is
   now `https://dzianisv.github.io/opencode-mobile/privacy/` — live & verified (HTTP 200) on
   the gh-pages branch, serving `distribution/privacy-policy.html`. This GitHub Pages URL is
   the canonical privacy URL cited across all store-submission docs (Play "App content"
   answers, IzzyOnDroid request). If the owner later deploys the branded
   `opencode.vibebrowser.app/privacy`, it can replace the GitHub Pages URL — this change is
   reversible. Source file: `distribution/privacy-policy.html` (markdown mirror:
   `distribution/privacy-policy.md`).

2. **Google Play → production (biggest unlock, ~15 min).**
   Play Console → app → Monitor and improve → Policy → **App content**. Complete the
   declarations using the pre-written, code-verified answers in
   `distribution/PLAY-APP-CONTENT-ANSWERS.md`. Then Production → create release → add
   the v0.4.3 AAB (CI already uploaded) → roll out → submit for review.

2. **F-Droid reach (any/all):**
   - Self-hosted repo updates automatically once the in-flight publish run is green —
     just share the repo URL above. (Verify: command below.)
   - **IzzyOnDroid** (fast, popular): file the inclusion issue at
     https://codeberg.org/IzzyOnDroid/repodata/issues using
     `distribution/izzyondroid-submission/INCLUSION-REQUEST.md` (needs a Codeberg account).
   - **Mainline F-Droid**: MR #39530 is filed and open at
     https://gitlab.com/fdroid/fdroiddata/-/merge_requests/39530 (needs a gitlab.com
     account that is a member of the MR, i.e. the account that filed it). Open the MR,
     read the maintainer's review comments/CI (fdroid build pipeline) under the
     "Activity"/"Pipelines" tabs, address any requested metadata changes by editing
     `metadata/cc.agentlabs.opencode.yml` on the MR's source branch (local source:
     `distribution/fdroid-submission/metadata.yml`), push, and reply to each reviewer
     thread. If CI is red, fix per the build log and re-push the source branch.

3. **Growth → 1k downloads:** post the launch kit in `distribution/launch/`
   (Show HN, Product Hunt, Reddit, X, dev.to) from your accounts, following the fire
   sequence in `distribution/launch/LAUNCH-CHECKLIST.md`.
   **Gate:** every post file contains `{{PLAY_URL}}` / `{{FDROID_URL}}` placeholders —
   do NOT post any file that still has a `{{...}}` token. Replace:
   `{{FDROID_URL}}` → `https://dzianisv.github.io/opencode-mobile/fdroid/repo` (live now);
   `{{PLAY_URL}}` → `https://play.google.com/store/apps/details?id=cc.agentlabs.opencode`
   (only valid after item 2's production rollout is live — until then, link the F-Droid
   repo + GitHub releases instead). ASO copy in `distribution/play-listing.md` /
   `distribution/app-store-listing.md`.

---

## Verify / common commands

```bash
npm run typecheck          # tsc --noEmit (clean)
npm test                   # node:test suite (4 passing)
gh run list --workflow=publish-fdroid.yml --limit 3      # F-Droid publish status
gh run list --workflow=cua-smoke.yml --limit 3           # E2E smoke status
# Is the live F-Droid repo updated to cc.agentlabs.opencode @ v0.4.3?
curl -s https://dzianisv.github.io/opencode-mobile/fdroid/repo/index-v1.json | \
  python3 -c "import sys,json;d=json.load(sys.stdin);print({p:[v['versionName'] for v in vs] for p,vs in d['packages'].items()})"
```

## Gotchas / notes
- `expo prebuild` regenerates `android/build.gradle` in CI → enforce signing in the
  workflow (apksigner re-sign step), not only in gradle.
- F-Droid breaks on androguard 4.1.4 (`'NoOverwriteDict' has no attribute 'append'`);
  use **4.1.3**. The published APK must be **v1+v2-only** (no v3) for it to parse.
- Play `versionCode` = `github.run_number` (auto-monotonic); re-tagging won't collide.
- F-Droid publish triggers on `v*` tags only (agent has **no admin** to
  `workflow_dispatch`/rerun; can push commits/tags).
- Session directory-scope invariant: all session ops must use `sessionScopeDirectory`
  or sessions go invisible (this was bug #10).
- Shared browser (chrome-devtools over Tailscale) was offline this session, so
  browser-driven console/Codeberg steps couldn't be attempted.

## Infra references (durable)
- OpenCode server (testing): `100.108.64.76:4096` (Tailscale host `openclaw-dev-1`).
- CUA smoke vision model: Azure `gpt-5.4`; endpoint
  `https://info-mjnxtt51-eastus2.cognitiveservices.azure.com`; gpt-5.x needs
  `max_completion_tokens` (not `max_tokens`). Secrets in repo Actions.
- GitHub auth (local): `source ~/.env.d/github-dzianisv.env`.
- Signing: production key SHA-256
  `0C:25:9D:94:E0:FF:EA:5D:63:19:61:4B:22:9D:4B:6B:DC:22:DE:1F:56:E3:8E:76:94:83:98:D2:DF:6A:A0:99`
  (same key across Play / F-Droid / IzzyOnDroid — in-place updates work).
