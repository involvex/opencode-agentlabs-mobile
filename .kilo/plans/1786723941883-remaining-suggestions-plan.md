# Remaining Feature Suggestions — Implementation Plan

## Context

` suggestions.md` was written before several recent batches. This plan corrects
the priority matrix against the actual codebase, then defines implementation
batches for the remaining TODO items.

---

## Updated Status (cross-checked against code)

| Feature | suggestions.md | Actual | Notes |
|---------|---------------|--------|-------|
| Session bookmarks & pinning | DONE | DONE | `pinnedSessions` in `sessions.ts` |
| Local full-text search | DONE | DONE | `session-search.ts` + cache |
| Session export (Markdown) | DONE | DONE | `export.ts` + Share |
| SSE event inspector | DONE | DONE | `app/debug/sse.tsx` |
| Prompt library | DONE | DONE | `prompts.ts` + `/prompt` slash cmd |
| Compact / density mode | DONE | DONE | `density.ts` + settings UI |
| Session templates | DONE | DONE | `templates.ts` + FAB modal |
| Message reactions | DONE | DONE | `reactions.ts` + emoji picker |
| Session cache / offline reading | DONE | DONE | `session-cache.ts` + hydration |
| Developer quick actions | DONE | DONE | Debug mode, reconnect, state dump, clear cache |
| Connection profiles | DONE | DONE | Reorder, names, auth headers |
| Custom theme colors | DONE | DONE | Accent color picker |
| Font size controls | DONE | DONE | Chat + terminal sliders |
| Auto-session naming | DONE | DONE | `autoNameSession` in `sessions.ts` |
| Dark/light/auto theme | DONE | DONE | `theme.ts` + settings |
| Message timestamps | DONE | DONE | Relative + absolute on press |
| **Reply / thread** | TODO | **DONE** | Quote-and-reply with preview bar |
| Session tags / labels | TODO | **DONE** | `sessionTags` map + chips |
| Unread indicators | — | DONE | `unreadCounts` + badge |
| Diff view (edit tools) | — | DONE | `DiffView.tsx` + `diff-compute.ts` |
| Speech-to-text input | — | DONE | `speech.ts` + mic button |

---

## Remaining TODO Items (sorted by personal value / effort)

### Tier 1 — Quick Wins (low effort, high personal value)

1. **Voice TTS auto-play** — completes voice-only mode; speak agent responses
2. **Smart session summary** — "Summarize in 3 bullets" background prompt
3. **Image context actions** — describe, OCR, save-to-gallery on image attachments
4. **Connection config export/import** — JSON bulk-setup for new devices

### Tier 2 — Medium Features

5. **Code execution card** — run bash/edit/write snippets locally with sandbox
6. **Keyboard shortcuts** — Ctrl/Cmd+N, /, K, Esc for physical keyboards
7. **Session backup/restore** — encrypted JSON export of all sessions + connections
8. **Connection health history** — uptime, reconnect count, latency sparkline
9. **Export to Obsidian/Notion** — Markdown frontmatter / JSON block formats

### Tier 3 — Larger Features

10. **Session branching / fork** — create child session from chosen message
11. **Split screen / tablet layout** — two-pane on wide screens
12. **Android shortcuts / PiP / widget** — app shortcuts, Quick Settings tile, PiP
13. **Local LLM mode (Ollama)** — offline chat via local provider
14. **Bandwidth / usage report** — per-connection data tracking + weekly digest
15. **Biometric lock per session** — per-session auth gate

---

## Implementation Batches

### Batch 1 — Voice Completion & Quick Wins

**Goal**: Finish voice mode and add small high-value utilities.

1. **Voice TTS auto-play**
   - Add `expo-speech` hook (`useSpeechOutput`) with play/stop/cancel
   - Setting: "Auto-play agent responses" (default off)
   - When enabled, speak assistant message text parts after `message.updated` SSE
   - Guard: only auto-play when app is foregrounded

2. **Image context actions**
   - Long-press image attachment → action sheet:
     - "Describe image" → sends vision prompt
     - "Extract text (OCR)" → sends OCR prompt  
     - "Save to gallery" → `expo-media-library` save
   - Requires `expo-media-library` permission

3. **Connection config export/import**
   - Export: JSON with URLs, directories, usernames (no passwords)
   - Import: bulk-add connections, skip duplicates by URL
   - Uses `expo-sharing` for file ops

4. **Smart session summary**
   - "Summarize" button in `SessionInfo` panel
   - Sends background prompt: "Summarize this conversation in 3 bullet points"
   - Shows summary as sticky banner or in info panel

### Batch 2 — Medium Features

**Goal**: Developer and power-user tooling.

5. **Code execution card**
   - In `ToolCallCard`, add "Run locally" button for bash/edit/write
   - Executes via WebView sandbox or native module
   - Developer-settings toggle to enable (opt-in security)

6. **Keyboard shortcuts**
   - Listen to `Keyboard` events from `react-native`
   - Ctrl/Cmd+N → new session
   - Ctrl/Cmd+/ → focus composer
   - Ctrl/Cmd+K → model picker
   - Esc → close bottom sheets

7. **Session backup/restore**
   - Export: all sessions, messages, parts, connections → JSON
   - Option: password-protected zip (using `expo-crypto` + `expo-file-system`)
   - Import: merge strategy (skip existing by ID)

8. **Connection health history**
   - Store per-connection: connect timestamps, reconnect counts, latency samples
   - Show sparkline in connection detail screen
   - Log auth-failure events

9. **Obsidian/Notion export**
   - Extend `export.ts`:
     - Obsidian: frontmatter (date, tags, model, tokens)
     - Notion: JSON block structure

### Batch 3 — Larger Features

**Goal**: Platform-level and advanced UX.

10. **Session branching**
    - Long-press message → "Branch from here"
    - Creates new session with messages up to that point
    - Requires server support for session creation with parent context

11. **Split screen / tablet layout**
    - `useWindowDimensions()` width check at 600dp
    - Left pane: session list (320dp wide)
    - Right pane: active session chat
    - Use `react-native-split-view` or manual flex layout

12. **Android shortcuts / PiP**
    - Static shortcuts in `AndroidManifest.xml` (new session, recent sessions)
    - PiP via `expo-pip` or native module when session is busy
    - Quick Settings tile via `TileService`

13. **Local LLM mode**
    - New connection type: "Local Server"
    - Talks to Ollama/llama.cpp on LAN
    - Requires implementing compatible streaming API

14. **Bandwidth / usage report**
    - Track bytes per connection in `sdk.ts` request/response interceptors
    - Show in connection detail
    - Weekly digest in Settings

15. **Biometric per-session lock**
    - Mark sessions as "locked" in store
    - Tapping locked session triggers auth gate before navigation

---

## Validation Plan

For each batch:
1. Unit tests for new store logic
2. CUA smoke test for UI flows
3. Manual verification on Android emulator
4. Offline behavior checks (cache, export/import)

## Out of Scope

- Server-side sync for tags, health history, or summaries (local-only)
- iOS widget extensions (Android-only shortcuts in this batch)
- LLM-based title generation (truncation only)
- Cross-device sync (all data stays local)
