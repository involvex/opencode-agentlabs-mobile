# OpenCode Mobile — Feature Suggestions

Personal fork. No publishing or release constraints — suggestions below favor
personal productivity and developer-experience over conservative/App-Store-safe choices.

---

## 1. Personal Productivity

### 1.1 Session Bookmarks & Pinning

**Effort**: low  
Pin favorite sessions to the top of the list. A simple boolean flag in the
session metadata + a "Pin" action in the session context menu. Stored locally
in the `sessions` store, synced with the server when possible.

### 1.2 Session Tags / Labels

**Effort**: medium  
Let you attach free-form tags (e.g., `project-foo`, `research`, `debug`) to
sessions. Tags appear as chips in the session list and enable tag-filtered
views. Persisted locally; optional server-side sync if the opencode API exposes
session metadata writes.

### 1.3 Session Templates

**Effort**: low-medium  
Save a prompt + model + directory + agent combination as a template. Tapping a
template in the FAB menu opens a new session pre-filled with that configuration.
Templates stored in SecureStore. Useful for recurring workflows (e.g., "Code
review" → model: `gpt-5.4`, agent: `code-reviewer`).

### 1.4 Local Full-Text Search

**Effort**: medium-high  
Search across all cached session messages locally. Index messages in a
SQLite/MMKV store on receipt; support query-by-text, filter by tag, filter by
date. Even a simple substring search over the message buffer would already be a
huge daily-driver improvement.

### 1.5 Session Export (Markdown / JSON)

**Effort**: low  
Export a session (or selected messages) to:

- Markdown — readable, shareable, git-friendly
- JSON — full fidelity including parts, token counts, timestamps, tool calls

Share sheet integration (`expo-sharing`) for sending to Notes, email, or file
manager.

### 1.6 Auto-Session Naming

**Effort**: low-medium  
Generate a session title from the first user message or from the agent's first
summary. Saves the manual rename step. Could be as simple as:
`truncate(firstUserMessage, 40)` or an LLM summarization call.

---

## 2. Developer & Power-User Tools

### 2.1 SSE Event Inspector (Debug Mode)

**Effort**: low  
A toggleable overlay (or separate screen) that shows raw SSE events as they
arrive — event type, payload, timestamp. Toggle via a shake gesture or
developer settings flag. Essential for debugging server-side issues without
running `adb logcat`.

### 2.2 API Request/Response Log

**Effort**: low-medium  
Capture all HTTP requests and responses (excluding auth headers) into an
in-memory ring buffer. Show in a "Network Log" screen with status codes,
latency, payload sizes. Redact secrets automatically. invaluable for diagnosing
why a request failed.

### 2.3 Session Cache / Offline Reading

**Effort**: medium-high  
Persist session messages to SQLite or MMKV so they survive app restarts and
are available offline. The app currently re-fetches sessions on every launch.
A local cache would:

- Show sessions instantly on cold start
- Allow reading old sessions without a server connection
- Reduce server load

Use the existing `message-merge.ts` reconciliation logic to keep cache and
server in sync.

### 2.4 Connection Health History

**Effort**: medium  
Track connection uptime, reconnect count, latency samples, and auth-failure
events per connection. Show as a small sparkline or log in the connection
detail screen. Helps identify flaky networks or misconfigured servers.

### 2.5 Developer Quick Actions

**Effort**: low  
Add a "Developer" section in Settings with shortcuts:

- **Force SSE reconnect** — useful when events stall
- **Clear local cache** — nuke persisted sessions/messages
- **Dump Zustand state** — export full store state to clipboard as JSON
- **Toggle debug logging** — verbose SSE + SDK logging to console
- **Simulate auth error** — trigger the 401 flow to verify handling

### 2.6 Keyboard Shortcuts (Expo Keyboard)

**Effort**: medium  
If using a physical keyboard (tablet, foldable, desktop):

- `Ctrl/Cmd + N` — new session
- `Ctrl/Cmd + /` — focus composer
- `Ctrl/Cmd + K` — model picker
- `Ctrl/Cmd + Shift + C` — copy last code block
- `Esc` — close bottom sheets / popovers

### 2.7 Session Diff / Branching

**Effort**: medium-high  
Compare two versions of a message (before/after revert) visually. Or fork a
session: create a new session that starts from a chosen message, discarding
everything after it. Useful for exploring alternative agent paths without
losing the original conversation.

---

## 3. Chat & Agent Enhancements

### 3.1 Message Reactions

**Effort**: low-medium  
Long-press a message to add a reaction emoji (👍 ❤️ 🎉 etc.). Reactions are
stored locally and displayed as small overlays. No server-side requirement —
purely a personal annotation layer.

### 3.2 Reply / Thread

**Effort**: medium  
Tap a message to quote it in a reply. The quoted message appears as a
collapsible reference above the composer and is included in the sent prompt.
Helps maintain context in long sessions.

### 3.3 Prompt Library

**Effort**: medium  
Save frequently used prompts as reusable snippets. Access via the slash
command (`/prompt`) or a dedicated bottom sheet. Snippets stored in SecureStore
with title, body, and optional model/directory/agent pre-selection.

### 3.4 Custom System Prompts Per Session

**Effort**: low-medium  
Allow setting a custom system prompt per session (or per directory). The
prompt is prepended to every message sent in that session. Expose via session
info panel or a small "system prompt" field in the composer toolbar.

### 3.5 Image Context Actions

**Effort**: low-medium  
When viewing an image attachment in a message, add actions:

- **Describe** — send "describe this image" as a follow-up prompt
- **Extract text (OCR)** — run a vision model to extract text
- **Save to gallery** — download to device photos

### 3.6 Code Execution Card

**Effort**: high  
When a tool call produces a code block (bash, edit, write), render an
execution card with:

- Language badge
- Copy button (existing)
- **Run locally** button — executes the code snippet on the device via a
  WebView-based sandbox or a native module
- Output preview

Caution: executing arbitrary agent-generated code locally has security
implications. For a personal fork, acceptable with an explicit "I understand"
toggle in developer settings.

### 3.7 Smart Session Summary

**Effort**: medium  
At any point in a session, tap a "Summarize" button that sends a background
prompt to the agent: "Summarize this conversation in 3 bullet points." Display
the summary as a sticky header or in the session info panel. Useful for
resuming long sessions after a break.

---

## 4. UI / Display Improvements

### 4.1 Compact / Density Modes

**Effort**: low-medium  
Add a "Density" setting (compact / default / comfortable) that adjusts:

- Message bubble padding
- Font size scaling
- List item spacing
- Toolbar height

Helps fit more content on screen, especially on smaller phones.

### 4.2 Custom Theme Colors

**Effort**: low  
Beyond light/dark mode, allow picking a primary accent color. Uses React Native
`Appearance` + a theme context. Store preference in `settings.ts`.

### 4.3 Font Size Controls

**Effort**: low  
Per-category font size slider (body, code, UI labels). Respects system
dynamic-type where possible but allows override.

### 4.4 Split Screen / Tablet Layout

**Effort**: medium-high  
On wide screens (> 600dp), show a two-pane layout:

- Left: session list (narrower)
- Right: active session chat

Already partially supported by the existing directory-grouped session list.
Use `react-native-window-dimensions` or Expo's `useWindowDimensions` to detect
width and switch layouts.

### 4.5 Session Info as Persistent Overlay

**Effort**: low-medium  
Instead of a pulldown, make the token/cost/stats bar a collapsible persistent
overlay at the top of the chat. Toggle with a single tap on the stats icon.
Shows live-updating token usage during generation without obscuring the full
screen.

### 4.6 Message Timestamps & Relative Time

**Effort**: low  
Show relative timestamps on messages ("2 min ago", "yesterday") with absolute
time on long-press. Currently the app shows timestamps in the session info
panel but not inline.

---

## 5. Android-Specific Enhancements

### 5.1 Home Screen Widget

**Effort**: medium  
Android app widget showing:

- Recent sessions (last 3–5)
- Quick "New Session" button
- Connection status (green/red dot)

Uses `expo-widgets` (if available) or a native widget module. For a personal
fork, a simple launcher shortcut is easier (`android/app/src/main/AndroidManifest.xml`
`<intent-filter>` with `ACTION_VIEW` + deep link).

### 5.2 Quick Settings Tile

**Effort**: medium  
A "New Session" tile in Android Quick Settings. Uses `android.service.quicksettings.TileService`.
Opens the app directly to the new-session flow.

### 5.3 App Shortcuts (Long-Press Icon)

**Effort**: low  
Define static shortcuts in `AndroidManifest.xml`:

- New Session
- Recent Session 1, 2, 3
- Scan QR to connect

### 5.4 Picture-in-Picture for Long Tasks

**Effort**: medium  
When a session is busy (agent running), allow entering PiP mode. Shows a
miniature status card ("Working...") that dismisses on completion. Uses
`expo-pip` or native `MediaPlayer`-style PiP.

### 5.5 Biometric Lock Per Session

**Effort**: low-medium  
Optionally require biometric auth to open a specific session (not just the app).
Mark sessions as "locked" in the session list; tapping one triggers the auth
gate before navigation.

---

## 6. Connection & Server Features

### 6.1 QR Code Connection Sharing

**Effort**: medium  
Generate a QR code from a connection config (URL, directory, username — no
password) that can be scanned by another device or saved for personal use.
Uses `expo-camera` for scanning and a QR library for generation.

### 6.2 Connection Profiles / Presets

**Effort**: low-medium  
Save named connection profiles (e.g., "Work Mac", "Home Server", "VPS").
One-tap switch between them. Already partially supported by the connections
list; add names and reorder.

### 6.3 Auto-Reconnect on Network Change

**Effort**: low-medium  
Listen to `NetInfo` state changes. When transitioning from offline → online,
automatically attempt to reconnect the SSE stream. Currently the SSE loop
retries with backoff, but explicitly triggering on network restoration reduces
wait time.

### 6.4 Bandwidth / Data Usage Tracker

**Effort**: medium  
Track approximate data usage per connection: bytes sent/received, number of
SSE events, image upload sizes. Show in connection detail. Useful on metered
connections.

---

## 7. Data Management & Backup

### 7.1 Session Backup / Restore

**Effort**: medium  
Export all sessions (messages, metadata, connections) to a single JSON file.
Import to restore on a new device. Include encryption option (password-protected
zip). Uses `expo-sharing` for file operations.

### 7.2 Export to Obsidian / Notion

**Effort**: medium  
Export sessions in formats friendly to note-taking apps:

- Obsidian: Markdown with frontmatter (date, tags, model, tokens)
- Notion: JSON block structure (or CSV for simple import)

### 7.3 Connection Config Export/Import

**Effort**: low  
Export all connections (URLs, directories, usernames — passwords excluded) to
JSON. Import to bulk-setup connections on a new device. Passwords remain in
SecureStore and must be re-entered.

---

## 8. Experimental / Fun

### 8.1 Local LLM Mode (Ollama / llama.cpp)

**Effort**: high  
Add a "Local Server" connection type that talks to a locally running Ollama or
llama.cpp instance instead of an opencode server. Requires implementing the
opencode-compatible API locally or using the opencode server's local provider
support. Enables fully offline AI chat.

### 8.2 Conversation Branching

**Effort**: medium-high  
At any point, "branch" the conversation: create a new session starting from
that message, with a different model or agent. Compare outcomes side by side.
Requires server-side support for creating sessions with a specific parent
message.

### 8.3 Voice-Only Mode

**Effort**: medium  
Full voice conversation: hold-to-talk → send → auto-play agent response via
TTS (`expo-speech`). No typing required. Configurable voice, speed, and
auto-play toggle. Useful for hands-free coding sessions.

### 8.4 Screen / Session Recording

**Effort**: medium  
Record a session as a replayable animation or video. Export as GIF/MP4 for
sharing or personal reference. Uses `expo-screen-recorder` or a frame-capture
approach.

### 8.5 Daily / Weekly Usage Report

**Effort**: medium  
Generate a personal usage digest: sessions created, messages sent, tokens used,
models used, time spent. Display as a simple chart or text summary in Settings.
Data stays on device; no server-side reporting.

---

## 9. Implemented but Unlisted Features

These features exist in the codebase but were not originally captured in the
suggestions list above. They are shipped and functional.

### 9.1 Speech-to-Text Input (Voice Dictation)

**Effort**: low  
Mic button in the composer uses `expo-speech-recognition` for voice dictation.
Supports hold-to-talk and continuous recognition. No server-side requirement.

### 9.2 Unread Message Indicators

**Effort**: low-medium  
Badge counts on sessions with unread messages. Persisted in the `sessions` store
as `unreadCounts`. Cleared on session open.

### 9.3 Diff View for Edit/Revert Tools

**Effort**: low-medium  
When a tool call produces an edit, render an inline diff (`DiffView.tsx`) showing
old → new with syntax highlighting. Uses `diff-compute.ts` for unified diff
generation.

### 9.4 Local Terminal

**Effort**: medium  
`TerminalView.tsx` + `local-terminal.ts` provide an in-app shell for running
commands on the device. Supports history, output streaming, and working directory
persistence per session.

### 9.5 Crash Reporting / Diagnostics

**Effort**: low-medium  
`ErrorBoundary.tsx`, `diagnostics.ts`, and `diagnostics-classify.ts` capture
unhandled errors, classify them (connection, auth, crash), and offer a "Share
report" action. Connection probing runs on failure to auto-diagnose network
issues.

### 9.6 Analytics / Telemetry

**Effort**: low  
PostHog analytics (`analytics.ts`) + custom telemetry (`telemetry.ts`) with a
consent modal (`TelemetryConsentModal.tsx`). Opt-in only; events stay anonymous.

### 9.7 Notifications System

**Effort**: medium  
Per-category push notifications (`notifications.ts`): permissions, questions,
completed, errors. Configurable per-category toggle in Settings. Uses Expo
Notifications API.

### 9.8 Biometric App Lock

**Effort**: low-medium  
App-level biometric auth (`auth.ts` + `AuthGate.tsx`) requiring fingerprint or
face ID to open the app or send sensitive commands. Stores auth state in
SecureStore.

### 9.9 Slash Commands

**Effort**: low  
Full slash command framework with typed registry, builtin actions, and custom
server commands. Builtins (`/new`, `/model`, `/agent`, `/prompt`, `/clear`,
`/export`, `/theme`, `/density`, `/summarize`, `/search`, `/help`) execute
immediately on selection. Custom server commands insert `/name ` into the
composer for the user to edit and send. Popover supports categories, keyboard
navigation (arrow keys + enter + escape), descriptions, and favorites/recent
tracking. Recent and favorite preferences persist across app restarts via
SecureStore (`expo-secure-store`) in the `useSlashCommands` Zustand store.
Implemented in `src/lib/slash-commands.ts` (registry + types),
`src/stores/slash-commands.ts` (persistence store), `SlashPopover.tsx`
(filtered popover UI), `SlashHelpSheet.tsx` (help reference bottom sheet),
`src/lib/keyboard-slash.ts` (arrow-key navigation hook), and wired into
`app/session/[id].tsx` via `useEffect` load on mount.

### 9.10 Auto-Reconnect on Network Restoration

**Effort**: low-medium  
SSE reconnect logic (`events.ts`) already implements exponential backoff with
jitter. Additional `NetInfo` listener triggers immediate reconnect on
offline → online transitions.

---

## Priority Matrix

| Feature                            | Effort      | Personal Value | Recommended Order | Status |
| ---------------------------------- | ----------- | -------------- | ----------------- | ------ |
| Session bookmarks & pinning        | Low         | High           | 1                 | DONE   |
| Local full-text search             | Medium      | High           | 2                 | DONE   |
| Session export (Markdown)          | Low         | High           | 3                 | DONE   |
| SSE event inspector                | Low         | Medium         | 4                 | DONE   |
| Prompt library                     | Medium      | High           | 5                 | DONE   |
| Compact / density mode             | Low-Medium  | Medium         | 6                 | DONE   |
| Session templates                  | Low-Medium  | High           | 7                 | DONE   |
| Message reactions                  | Low-Medium  | Medium         | 8                 | DONE   |
| Session cache (offline reading)    | Medium-High | High           | 9                 | DONE   |
| Session auto-naming                | Low-Medium  | High           | 10                | DONE   |
| Session tags / labels              | Medium      | High           | 11                | DONE   |
| Reply / thread                     | Medium      | Medium         | 12                | DONE   |
| Dark / light / auto theme          | Low         | High           | 13                | DONE   |
| Font size controls                 | Low         | Medium         | 14                | DONE   |
| Message timestamps & relative time | Low         | Medium         | 15                | DONE   |
| Keyboard shortcuts                 | Medium      | Medium         | 16                | DONE   |
| Developer quick actions            | Low         | Medium         | 17                | DONE   |
| Connection health history          | Medium      | Low-Medium     | 18                | TODO   |
| Android widget / shortcuts         | Low-Medium  | Low-Medium     | 19                | TODO   |
| QR code connection                 | Medium      | Low            | 20                | TODO   |
| Custom theme colors                | Low         | Low-Medium     | 21                | DONE   |
| Voice-only mode                    | Medium      | Medium         | 22                | TODO   |
| Code execution card                | High        | Medium         | 23                | TODO   |
| Local LLM mode                     | High        | High           | 24                | TODO   |
| Session branching                  | Medium-High | Medium         | 25                | TODO   |
| Split screen / tablet              | Medium-High | Medium         | 26                | TODO   |
| Smart session summary              | Low         | Medium         | 27                | DONE   |
| Connection config export/import    | Low         | Low-Medium     | 28                | DONE   |
| Image context actions              | Low-Medium  | Low-Medium     | 29                | DONE   |
| Voice TTS auto-play                | Low         | Medium         | 30                | DONE   |

> **Quick wins** (low effort, high personal value): bookmarks, export, search,
> SSE inspector, developer shortcuts, templates, density mode. All are implemented.

> **Implemented in batch 1** (DONE): session pinning, local search (session list),
> Markdown export + Share, SSE inspector (`/debug/sse`), density modes, message
> reactions (tap toggle + long-press picker), dark/light/auto theme, accent color,
> font size controls, developer settings (force reconnect, state dump), connection
> profiles with auth headers, reply/thread quote-and-reply, session auto-naming,
> session tags, smart session summary, connection config export/import, image
> context actions, voice TTS auto-play, keyboard shortcuts, message timestamps,
> speech-to-text input, unread indicators, diff view, local terminal, crash
> reporting, analytics/telemetry, notifications, biometric app lock, slash commands,
> auto-reconnect on network change.
