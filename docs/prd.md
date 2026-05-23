# OpenCode Mobile — Product Requirements Document (PRD)

> Audience: product, design, support, and any engineer onboarding to the app.
> For implementation/architecture details, see [`tdd.md`](./tdd.md).

## 1. Product Vision

OpenCode Mobile is a phone-first companion for the [OpenCode](https://github.com/anomalyco/opencode) coding agent. It lets a developer keep an agent running on a powerful machine (laptop, cloud VM, Tailscale host) and stay in the loop from anywhere — review what the agent is doing, approve permissions, answer follow-up questions, and kick off new tasks — without needing to be at the keyboard.

The phone is not where heavy coding happens. The phone is where **continuity** happens: catching a long-running task at the right moment, unblocking it, and resuming work later from a real workstation.

## 2. Target Users

| User | Why they use the app |
| ---- | -------------------- |
| Solo dev with a home dev box / cloud VM | Trigger or babysit long jobs while away from the laptop (commute, errands, meetings). |
| Devs working over Tailscale / Cloudflare Tunnel | Need a secure way to reach a private server from a phone. |
| Power users who run multiple agents | Want one place to monitor several servers and switch between them. |

Out of scope: writing code on the phone full-time, replacing the desktop IDE, mass-collaboration features.

## 3. Core User Stories

### 3.1 Connect to a server
- As a user, I add a server by URL (`https://host:port`), optionally with HTTP basic-auth credentials, and the app stores them in the OS keychain.
- I can save multiple connections (local network, Tailscale, tunnel, cloud) and switch between them.
- If a connection fails, I get a **plain-English diagnosis** (not "Network request failed"), and a one-tap **Share report** that I can email or paste into Slack.

### 3.2 Authenticate
- On launch, the app can require Face ID / Touch ID / device biometrics before showing any sessions (opt-in, per-device setting).
- Sending a message can require an additional biometric confirmation (opt-in, for high-stakes setups).

### 3.3 Browse sessions
- The Sessions tab lists all sessions on the active connection, newest first, with title and a busy/idle indicator.
- Tapping a session opens its chat history; old messages load on scroll-up.

### 3.4 Chat with the agent
- New messages stream in over SSE in real time, including reasoning, tool calls, and final answers.
- Markdown is rendered with code blocks that have a one-tap **Copy** button.
- A status pill ("Thinking…", "Running command…", "Searching codebase…") tells the user what the agent is doing right now.
- The user can send a new message; the app posts it fire-and-forget and waits for SSE events to confirm.
- The user can **abort** a running task.

### 3.5 Approve permissions / answer questions
- When the agent requests permission to run a tool (e.g. `bash`, `edit`), the user gets an in-app prompt **and** an OS push notification.
- When the agent asks the user a question (multi-choice or free-form), the user gets the same dual prompt.
- The user can approve, deny, or answer from anywhere — including a notification tap that deep-links into the relevant session.

### 3.6 Stay informed
- Notifications cover: task completed, permission asked, question asked, session error, prolonged disconnect.
- Each notification category can be toggled in Settings.
- A tap on any notification opens the right session.

### 3.7 Recover from failures
- If the network drops, SSE reconnects with exponential backoff and jitter.
- If a render crash happens, the user sees a **diagnostic screen** (not a white screen / native red box) with the error, a **Share Report** button, and a **Try Again** button.
- Unexpected errors anywhere in the app are reported to Sentry automatically (when telemetry is enabled at build time); expected errors (timeouts, biometric-cancelled, etc.) are not — to keep signal high.

## 4. Non-Functional Requirements

- **Privacy.** URLs that contain credentials (basic-auth or `?token=…`) are scrubbed before they leave the device. No PII in default Sentry payloads. No content of chat messages is uploaded.
- **Offline-first diagnostics.** Even with no internet, the user can share a full report via the OS share sheet (clipboard + native share).
- **No required cloud dependency.** The app talks only to the user's own OpenCode server. Sentry is opt-in via build-time env var and a hard no-op when absent.
- **Battery / data.** No background polling; SSE only when the app is in the foreground or actively used. Reconnect backoff caps at 15s.
- **Security.** Credentials live in Keychain/Keystore via `expo-secure-store`. Optional biometric gate. Cleartext HTTP is allowed on Android only because users frequently hit `http://192.168.x.x:4096` on their own LAN.

## 5. Developer Workflow

> See [`tdd.md`](./tdd.md) for architecture details; this section covers the day-to-day workflow.

### 5.1 Local dev
```bash
npm install
npx expo start          # Metro bundler, scan QR with Expo Go
npx expo run:android    # build + install dev client on emulator/device
npx expo run:ios        # macOS only
```

### 5.2 Required env (optional but recommended)
| Var | Purpose | Where |
| --- | ------- | ----- |
| `EXPO_PUBLIC_SENTRY_DSN` | Enables crash reporting; absent → telemetry is a no-op | `.env` (local) + Bitwarden + GitHub Actions secret |
| `SENTRY_AUTH_TOKEN` | sentry-cli source-map upload during build | Bitwarden + GitHub Actions |
| `SENTRY_ORG` / `SENTRY_PROJECT` | sentry-cli release tagging | Bitwarden + GitHub Actions |

All secrets are stored in Bitwarden under folder `opencode-mobile`. See `AGENTS.md` for retrieval commands.

### 5.3 Type / lint
```bash
npm run typecheck   # strict TypeScript, must pass before merge
```

### 5.4 Release
```bash
# 1. Bump app.json expo.version
# 2. Commit: "release: vX.Y.Z"
# 3. Tag and push:
git tag vX.Y.Z
git push origin main --tags
# CI (.github/workflows/build.yml) builds APK + GitHub Release
```

### 5.5 Observability
- **Sentry dashboard:** `sentry.io → vibetechnologies → opencode-mobile`
- **Alert email:** configure issue alert rules on the Sentry project to send to `dzianisvv@gmail.com` (or your distribution list).
- **In-app log buffer:** the last 200 log lines are always available in any shared diagnostic report; users can reproduce a bug and immediately share the trace.

## 6. Success Metrics

- **P0 — Crash-free sessions:** ≥ 99.5 % (Sentry sessions). Any release that drops below 99 % requires a hotfix.
- **P1 — Connection diagnostic helpfulness:** support requests for "Connection Failed" → 0 generic complaints; all reports come with a classification (`tls-error`, `timeout`, `no-internet`, etc.).
- **P2 — Reconnect recovery:** when the network blips for < 30 s, the user notices via a small banner but does not lose state.
- **P3 — Notification latency:** ≤ 5 s from agent event → push notification on the device.

## 7. Out of Scope (v0.x)

- Editing files on the phone.
- Running OpenCode locally on the device.
- Multi-user / shared sessions.
- Voice input beyond what the OS dictation keyboard provides.
- iPad / tablet-optimised layout (phone-first only; tablet works but is not designed for).
