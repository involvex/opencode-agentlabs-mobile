# Mobile App - AGENTS.md

## Agent Operating Rules (read first)

**Failure taxonomy — classify every failure before acting. Escalate cheapest-first; never skip a rung or repeat one:**
- **transient** (network blip, flaky): retry at most 2×.
- **code** (your bug, wrong path, bad arg): fix, then retry.
- **tool-usage-gated** (you called a *working* tool wrong): fix the *call*, not the tool. Cheapest fix — try this before assuming the tool is broken. Example: chrome-devtools `new_page` with `isolatedContext` opens a cookieless context; instead use `list_pages` → `select_page` to drive the existing authenticated tab.
- **tooling-gated** (the tool's *source* is genuinely broken): **diagnose before fixing** — verify it's actually broken (read the code, reproduce). If broken, spawn a fix-it subagent to patch + rebuild it, then retry. Do NOT stop.
- **infra** (CI runner, emulator boot timeout): report it; do not try to "fix" someone else's infrastructure.
- **human-gated** (only when no automated path exists): emit ONE precise instruction for the human, mark the task **BLOCKED**, and continue all other automatable work. Never re-attempt across turns.

**Diagnose before fixing:** Before patching or replacing any tool, confirm it is actually the cause. Copilot burned 39h assuming chrome-devtools-mcp was broken — it wasn't (it already drives the authenticated default context via `browser.defaultBrowserContext()`/`browser.pages()`). A 3-minute diagnostic subagent would have caught this.

**Known gated steps:**
- Play Console **API-access grant** to the service account — *was* the blocker; now granted (publish run 26662900471 succeeded, AAB on internal track, versionCode 19). One-time path if re-needed: Play Console → Setup → API access → link GCP project `opencode-mobile-deploy` → grant `playstore-deploy@opencode-mobile-deploy.iam.gserviceaccount.com` Admin/Release-manager.
- **Add internal testers** (Play Console → Internal testing → Testers): the genuinely human-gated residual. Google's anti-automation blocks CDP-controlled Chrome sign-in, so this UI step needs a human (or a real, non-CDP browser session).

**Stop discipline:** If a tool returns the same error 3× (or no new artifact/commit is produced across several turns), STOP. Print a BLOCKED summary with the single human action needed. A vague "please do X and let me know" that leaves you idle is worse than a clean stop — don't do it.

**Work-tracking discipline:**
- Track multi-step/upgrade work in the **related GitHub issue**, updated via `gh issue comment` — NOT by repeatedly editing AGENTS.md and NOT in scratch files under `/tmp` (e.g. no `/tmp/playconsole-fill.md`). Keep reference material (listing copy, form answers) in the repo under `distribution/` or as issue comments.
- AGENTS.md is for durable conventions only; do not churn it with task status.
- **Never claim a step done without verifying it in the real channel** (e.g. an app exists only if it appears in the Play Console app-list; an AAB is the right package only if its manifest says so). Do not invent IDs.
- **Driving web UIs:** snapshot → act on the *current* uids → re-snapshot. Never fire batched/guessed clicks; if a page shows "Loading"/an error toast, wait and re-snapshot rather than clicking blind.

## Overview

React Native / Expo mobile client for opencode. Connects to an opencode server instance via HTTP + SSE for real-time updates.

**Repo**: `dzianisv/opencode-mobile` (standalone, not part of opencode monorepo)
**Package name**: `cc.agentlabs.opencode`

## Architecture

```
app/                    # Expo Router file-based routing
├── (tabs)/             # Tab navigation (sessions, connections, settings)
├── session/[id].tsx    # Chat screen
└── connection/         # Add/edit connection screens
src/
├── components/         # Reusable UI components
│   ├── markdown/       # Markdown renderer (wraps react-native-marked)
│   └── AuthGate.tsx    # Biometric auth gate
├── lib/
│   ├── sdk.ts          # HTTP + SSE client for opencode server API
│   └── types.ts        # Re-exported types
└── stores/             # Zustand state stores
    ├── sessions.ts     # Session list, messages, parts
    ├── connections.ts  # Server connections, client lifecycle
    ├── events.ts       # SSE event stream, status tracking, permissions, questions
    └── auth.ts         # Biometric auth
scripts/
└── android-cua-smoke.py  # LLM-powered CUA E2E test
```

## Key Patterns

- **SSE for real-time**: The `events.ts` store connects to `/global/event` and dispatches to other stores
- **Fire-and-forget sends**: `sendMessage` posts to the API but doesn't await response; SSE events drive all UI updates
- **Session status**: Derived from `session.status` events (`idle`/`busy`/`retry`) + last part type for status text
- **Markdown**: `react-native-marked` wrapped in our own `Markdown` component with custom `CodeBlock` (copy button). Designed to be swappable/publishable later.

## Style Guide

- Prefer `const` over `let`
- Avoid `else` statements, use early returns
- Prefer single-word variable names
- Avoid `try/catch` where possible
- Avoid `any` type
- Use Bun APIs where applicable (for scripts, not in RN runtime)

## Running

```bash
npm install
npx expo start        # Expo dev server
npx expo run:android  # Android emulator
```

## Connecting

Run `opencode serve --hostname 0.0.0.0 --port 4096` on your machine, then add a connection in the app with your machine's local IP and port 4096.

**Dev server**: `100.108.64.76:4096` (Tailscale, hostname `openclaw-dev-1`)

## Android Emulator (local dev)

**IMPORTANT: Do NOT install SDK/AVD on the system disk. Use the external disk.**

```bash
export ANDROID_HOME=/Volumes/Dzianis-3/macbook2020/android-sdk
export ANDROID_AVD_HOME=/Volumes/Dzianis-3/macbook2020/android-avd
export GRADLE_USER_HOME=/Volumes/Dzianis-3/macbook2020/gradle-cache
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"

emulator -avd test -no-window -no-audio -no-boot-anim -gpu swiftshader_indirect -no-snapshot -port 5554
adb wait-for-device
# Wait for boot:
timeout 120 bash -c 'while [ "$(adb shell getprop sys.boot_completed 2>/dev/null)" != "1" ]; do sleep 2; done'
```

SDK location: `/Volumes/Dzianis-3/macbook2020/android-sdk` (API 34, arm64-v8a system image).
AVD location: `/Volumes/Dzianis-3/macbook2020/android-avd`.
Gradle cache: `/Volumes/Dzianis-3/macbook2020/gradle-cache` (or symlink from `/Volumes/GradleCache/gradle-home`).

## CUA Smoke Test (E2E via Vision LLM)

The script `scripts/android-cua-smoke.py` drives the emulator via ADB using a vision model loop (screenshot → LLM → action → repeat).

### Running locally

```bash
source ~/.env.d/azure-openai.env
python3 scripts/android-cua-smoke.py --model gpt-5.4 --include-xml
```

### Azure OpenAI credentials

The correct Azure AI Services endpoint (with actual deployments) is:
- **Endpoint**: `https://info-mjnxtt51-eastus2.cognitiveservices.azure.com`
- **Env file**: `~/.env.d/azure-openai.env`
- **Available vision models**: `gpt-5.4`, `gpt-5.2`, `gpt-5.1`, `gpt-4.1`

> **WARNING**: The `vibe-dev-ai.cognitiveservices.azure.com` resource has NO deployments (only a model catalog). Do NOT use it for inference. Always use `info-mjnxtt51-eastus2`.

### API notes for gpt-5.x models

- Use `max_completion_tokens` (NOT `max_tokens`) — the older param is rejected.
- Use `AzureOpenAI` client from the `openai` Python SDK with `api_version="2024-08-01-preview"`.
- Vision works: pass `image_url` with `data:image/png;base64,...` in user message content array.

### CI

GitHub Actions workflow: `.github/workflows/cua-smoke.yml`
Secrets required: `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT` (already set on `dzianisv/opencode-mobile`).

**Triggers**: Runs on push to `main` (with path filters) AND on `v*` tags (releases).

### When to run CUA test

**MANDATORY**: Run the CUA smoke test before any merge to `main` or release:
1. Before merging a PR that touches `src/**`, `app/**`, or `scripts/android-cua-smoke.py`
2. After creating a release tag — CI runs it automatically
3. When debugging UI issues — run locally with `--include-xml` for richer context

If the CUA test fails, do NOT merge or release until fixed.

## Secrets Management

All project secrets are stored in Bitwarden vault under folder **`opencode-mobile`**.

Use the `bitwarden-cli` skill to read/write secrets. Quick reference:

```bash
# Unlock (needs BW_PASSWORD in env or ~/.bitwarden_credentials)
source ~/.bitwarden_credentials
export BW_SESSION=$(bw unlock --passwordenv BW_PASSWORD --raw)
bw sync --session "$BW_SESSION"

# Get a secret
bw get notes "EXPO_PUBLIC_SENTRY_DSN" --session "$BW_SESSION"

# List all secrets in the folder
FOLDER_ID=$(bw list folders --session "$BW_SESSION" | jq -r '.[] | select(.name=="opencode-mobile") | .id')
bw list items --session "$BW_SESSION" | jq --arg f "$FOLDER_ID" '[.[] | select(.folderId==$f) | {name}]'
```

Secrets stored in vault:
- `EXPO_PUBLIC_SENTRY_DSN` — Sentry ingest DSN (embedded in APK at build time)
- `SENTRY_AUTH_TOKEN` — sentry-cli upload token (source maps, releases)
- `SENTRY_ORG` — `vibetechnologies`
- `SENTRY_PROJECT` — `opencode-mobile`

These same secrets are set as GitHub Actions secrets on `dzianisv/opencode-mobile` for CI builds.

**Do NOT store secrets in `.env` files committed to the repo.** `.env` is gitignored — local copy only.

## Chrome DevTools (Browser Automation)

The project uses `@vibebrowser/chrome-devtools-mcp` from `github.com/dzianisv/chrome-devtools-mcp`. It runs an MCP server over HTTP/SSE, allowing multiple agents to connect remotely.

**No `--remote-debugging-port` needed.** The daemon discovers Chrome via `--autoConnect` (reads `DevToolsActivePort` file). Port is discovered automatically.

**Driving an authenticated session:** The daemon connects to your *real* Chrome profile (authenticated). To act on a logged-in page, use `list_pages` → `select_page` on the existing tab. Do **not** pass `isolatedContext` to `new_page` — that opens a cookieless context that cannot see your login. (Verified: the MCP code already uses `browser.defaultBrowserContext()`; logged-out sessions come from misuse, a profile/`--user-data-dir` mismatch, or Google's anti-automation block — not a tool bug.)

**Local Copilot CLI config** (in `.github/copilot-mcp.json` or IDE MCP settings):
```json
{
  "chrome-devtools": {
    "type": "remote",
    "url": "http://localhost:9333/mcp",
    "enabled": true
  }
}
```

**Starting the daemon:**
```bash
chrome-devtools start --autoConnect --port 9333
```

## GitHub Auth

For pushes/gh CLI on this repo: `source ~/.env.d/github-dzianisv.env`

## Google Play Console

- **Developer account**: VIBE TECHNOLOGIES, LLC (ID: `8842655543970815326`), Google login `vibeteaichnologies@gmail.com`. The `/u/N/` index is NOT stable — if a console URL bounces to accept-terms/create-developer-account you're on the wrong Google account (e.g. `dzianisvv@gmail.com` hits a ToS gate); use the developer-account chooser to reach VIBE.
- **Rebrand (2026-05-30)**: package renamed `ai.opencode.mobile` → `cc.agentlabs.opencode`. A NEW Play Console app is required (package IDs can't be renamed) — **NOT yet created** (app-list shows only legacy ai.opencode.mobile). Do NOT trust any in-session app IDs; verify only by seeing the app in the live app-list. First AAB upload must be MANUAL via UI (Google blocks the Developer API for a new app's first release); CI publishes updates after. CI `packageName` already = `cc.agentlabs.opencode`. NOTE: CI publish build needs the "Purge stale generated sources" step (commit 67e4c1f) or cached old-package autolinking breaks compile. Real AAB ready at /tmp/cc.agentlabs.opencode.aab (61MB, manifest-verified) for manual upload.
- **Legacy app (orphaned)**: `ai.opencode.mobile`, app ID `4975545755653045321` — published v19 to internal track (run 26662900471), superseded by the rebrand.
- **Track**: Internal testing (no review required, up to 100 testers)
- **Service account**: `playstore-deploy@opencode-mobile-deploy.iam.gserviceaccount.com` (account-level API access already granted)

## Related Issues

- Upstream: `anomalyco/opencode#10288`
- Branch on upstream fork: `feat/android-backbone-10288` on `dzianisv/opencode`
