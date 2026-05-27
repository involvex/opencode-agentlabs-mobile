# Mobile App - AGENTS.md

## Overview

React Native / Expo mobile client for opencode. Connects to an opencode server instance via HTTP + SSE for real-time updates.

**Repo**: `dzianisv/opencode-mobile` (standalone, not part of opencode monorepo)
**Package name**: `ai.opencode.mobile`

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

```bash
export PATH="/tmp/android-sdk/platform-tools:/tmp/android-sdk/emulator:$PATH"
emulator -avd test -no-window -no-audio -no-boot-anim -gpu swiftshader_indirect -no-snapshot -port 5554
adb wait-for-device
# Wait for boot:
timeout 120 bash -c 'while [ "$(adb shell getprop sys.boot_completed 2>/dev/null)" != "1" ]; do sleep 2; done'
```

SDK location: `/tmp/android-sdk/` (API 34, x86_64 system image).

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

- **Developer account**: VIBE TECHNOLOGIES, LLC (ID: `8842655543970815326`)
- **App**: OpenCode Mobile (package: `ai.opencode.mobile`, app ID: `4975545755653045321`)
- **Console URL**: https://play.google.com/console/u/6/developers/8842655543970815326/app/4975545755653045321/app-dashboard
- **Track**: Internal testing (no review required, up to 100 testers)
- **Service account**: `playstore-deploy@opencode-mobile-deploy.iam.gserviceaccount.com`

## Related Issues

- Upstream: `anomalyco/opencode#10288`
- Branch on upstream fork: `feat/android-backbone-10288` on `dzianisv/opencode`
