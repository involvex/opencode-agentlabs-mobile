# Verify — rebrand-cc-agentlabs

## Success metric (success.md)
publish-play-store.yml builds app-release.aab with applicationId cc.agentlabs.opencode (build green) AND cua-smoke.yml passes (emulator launches cc.agentlabs.opencode + vision E2E completes).

## Evidence (sha 6405e2b — first build with rename actually committed)
- HEAD == origin == 6405e2b; core package files committed; `git status` core-clean.
- HEAD build.gradle applicationId = cc.agentlabs.opencode; app.json package = cc.agentlabs.opencode.
- **Build Android APK 26683001496 => success** (real cc.agentlabs.opencode APK).
- **Publish build (earlier) green** but that one (927bcc3) pre-dated the committed rename → built OLD package; superseded.
- **CUA Smoke Test 26683001488 => failure**: `RESULT: fail (goal not reached: open a session and send a message)`, "no actionable element found" at step ~19/20.

## Verdict
- **Rename: VERIFIED.** New package builds, installs, and launches — the vision smoke drove the live rebranded app for ~18 steps before the goal step. Build is green.
- **CUA smoke red = PRE-EXISTING, env-caused, NOT a rename regression.** Pre-rebrand run 26563595855 (sha ec90634) failed with the identical message ("goal not reached: open a session and send a message", step ~17). Root cause: the smoke's goal needs a reachable opencode server to open a session; GitHub-hosted runners cannot reach the Tailscale dev server (100.108.64.76:4096). No server → no session → goal unreachable.

## Out of slice
- Make CUA smoke a true E2E (spin `opencode serve` in CI, point app at localhost) → filed as follow-up issue.
- New Play Console app + first manual AAB upload + testers → teammate-owned.
- Apply SEO copy in console (task #3) → teammate-owned.

## Runtime launch evidence (cua-smoke dispatch 26682904019 @ 6405e2b)
```
Starting: Intent { cmp=cc.agentlabs.opencode/.MainActivity }
[prep] foreground package: cc.agentlabs.opencode
[step 1..14] vision-LLM drove live app
[step 14] fail -> Connection failed: timeout to http://100.108.64.76:4096
```
New package launches + foregrounds + renders UI. Fail = env gap #15 (CI can't reach dev server), not a regression.

PROD: n/a for this slice (Play Store upload teammate-owned). RENAME: pass (build green + runtime launch verified).
