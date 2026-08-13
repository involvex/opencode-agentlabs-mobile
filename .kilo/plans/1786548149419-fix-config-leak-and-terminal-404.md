# Fix Plan: Remove Leaked API Keys & Terminal WebSocket 404

## Issue 1: Remove leaked API keys from config.json

**Root cause:** The opencode server writes `config.json` (containing provider API keys, MCP tokens, agent prompts) into whatever directory it runs in. Because this repo was opened by the server, the file landed here and was committed to git.

**Fix:**
1. `git rm config.json` — remove the tracked file
2. Add `config.json` to `.gitignore` so future server runs don't re-add it
3. Commit the removal

## Issue 2: Terminal WebSocket connection fails with 404 Not Found

**Root cause:** `src/lib/pty-ws.ts:34` builds the WebSocket path as `/pty/${ptyId}/connect`, but the server expects `/api/pty/${ptyId}/connect`. The REST SDK endpoints (`sdk.ts`) already use the `/api/pty/...` prefix. The code's own comment confirms the v2 path is `/api/pty/:id/connect`.

**Fix:**
1. In `src/lib/pty-ws.ts`, line 34, change:
   ```ts
   `/pty/${opts.ptyId}/connect`,
   ```
   to:
   ```ts
   `/api/pty/${opts.ptyId}/connect`,
   ```
2. Run typecheck to verify

## Validation
- Confirm `git status` shows `config.json` removed and `.gitignore` updated
- Run `bun run typecheck` after the WebSocket fix
- Test terminal connection: open a session in the app, verify the terminal loads without 404/timeout
