# Code Review Fixes — Implementation Plan

Five review actions to apply to `opencode-agentlabs-mobile`. Ordered by dependency and blast-radius.

---

## 1. Create missing Android secure-store XML rules

**Files:** `android/app/src/main/res/xml/secure_store_backup_rules.xml`, `secure_store_data_extraction_rules.xml`

`AndroidManifest.xml` already references both files on line 23:
```xml
android:fullBackupContent="@xml/secure_store_backup_rules"
android:dataExtractionRules="@xml/secure_store_data_extraction_rules"
```
But the files don't exist, so a clean build or backup-restore flow will fail.

**Steps:**
1. Create `android/app/src/main/res/xml/` directory.
2. Write `secure_store_backup_rules.xml`:
   ```xml
   <?xml version="1.0" encoding="utf-8"?>
   <full-backup-content>
     <exclude domain="sharedpref" path="device_prefs.xml"/>
   </full-backup-content>
   ```
3. Write `secure_store_data_extraction_rules.xml`:
   ```xml
   <?xml version="1.0" encoding="utf-8"?>
   <data-extraction-rules>
     <exclude domain="sharedpref" path="device_prefs.xml"/>
   </data-extraction-rules>
   ```
4. Verify `./gradlew assembleDebug` succeeds.

**Risk:** Low. These files are already referenced; adding them is a pure fix.

---

## 2. Use `formatReportForSupport()` in `shareReport()`

**File:** `src/lib/diagnostics.ts:234-249`

`shareReport()` currently calls `formatReport(report)` on line 235, which includes the raw `report.url` (user's server address). The dedicated `formatReportForSupport()` (line 229) redacts the host and all seen hosts before formatting.

**Steps:**
1. In `shareReport()`, replace `formatReport(report)` with `formatReportForSupport(report)`.
2. Run `bun run typecheck`.

**Risk:** Very low. Single-line change; `formatReportForSupport` already exists and is used nowhere else.

---

## 3. Move WebSocket auth from URL query to Authorization header

**Files:** `src/lib/pty-ws.ts`, `src/components/chat/TerminalView.tsx`

Current behavior (`pty-ws.ts:43-49`): `buildPtyWsUrl()` appends `auth_token` (Base64 `username:password`) to the WebSocket URL query string when no `ticket` is present.

**Constraint:** React Native's standard `WebSocket` constructor does **not** accept custom headers. A decision is needed on mechanism before implementation.

**Recommended path:**
1. Confirm whether the opencode server PTY endpoint (`/api/pty/:id/connect`) accepts `Authorization: Basic <credentials>` on the WebSocket upgrade handshake. If yes, proceed.
2. If the server requires URL auth only, flag as **blocked — server change required**.
3. If neither, evaluate a header-capable WebSocket polyfill (e.g., a small native module or Expo-compatible library) and note the added dependency.

**If server supports header auth:**
1. Update `PtyWebSocket.connect()` signature to accept optional `{ username, password }` and set `Authorization` header via the chosen mechanism.
2. Update `buildPtyWsUrl()` to stop appending `auth_token` to the query string. Keep `ticket` in the query (it's a server-issued one-time token, not basic auth).
3. Update `TerminalView.tsx` to pass `username`/`password` to `PtyWebSocket.connect()` instead of `buildPtyWsUrl()`.
4. Run `bun run typecheck`.

**Risk:** Medium. Blocked on server capability or a WebSocket library change. Verify before coding.

---

## 4. Extract `NewSessionModal` and `RenameModal` from `app/(tabs)/index.tsx`

**Files:** `app/(tabs)/index.tsx`, new component files under `app/(tabs)/` or `src/components/tabs/`

Current inline modals:
- **NewSessionModal**: lines 1015–1463 (~450 lines)
- **RenameModal**: lines 1465–1526 (~60 lines)

**Steps:**
1. Create `src/components/tabs/NewSessionModal.tsx`:
   - Accept props: `visible`, `onClose`, plus all state/actions currently referenced inside the modal (`isCreating`, `customDir`, `templateName`, `selectedTemplateID`, `templates`, `activeConnection`, `createSession`, `addRecentDirectory`, `handleSaveTemplate`, `handleDeleteTemplate`, `onBrowse`, `serverHome`, `isDark`, `t`, etc.).
   - Move the full Modal JSX and its handlers (`onCreateInDirectory`, `handleSaveTemplate`, `handleDeleteTemplate`, `openBrowser`, `onBrowse`) into the new file.
   - Keep `Stylesheet` definitions in `index.tsx` or move them too — prefer keeping modal-specific styles with the component to reduce coupling.
2. Create `src/components/tabs/RenameModal.tsx`:
   - Accept props: `visible`, `onClose`, `onSubmit`, plus `renameText`, `setRenameText`, `submitRename` equivalents.
3. Replace inline Modal blocks in `index.tsx` with `<NewSessionModal .../>` and `<RenameModal .../>`.
4. Ensure `index.tsx` still compiles and all `testID`s remain unchanged.
5. Run `bun run typecheck`.

**Risk:** Medium. Large diff; careful prop drilling needed. Avoid breaking the directory-switcher restore logic (`restoreNewSessionOnDismiss` ref).

---

## 5. Move `abortedSessions` / `erroredSessions` Sets into Zustand state

**Files:** `src/stores/sessions.ts`, `src/stores/events.ts`

Currently:
- `abortedSessions` is a module-level `Set<string>` exported from `sessions.ts:118`.
- `erroredSessions` is a module-level `Set<string>` in `events.ts:80`.

Both are mutated directly (`add`/`delete`/`has`/`clear`) outside the store API, which makes them invisible to React devtools, time-travel, and tests.

**Steps:**
1. In `src/stores/sessions.ts`:
   - Add `abortedSessions: string[]` to `SessionsState`.
   - Add actions: `markAborted(sessionID: string)`, `clearAborted(sessionID?: string)` (or `unmarkAborted`).
   - Replace direct `abortedSessions.add(id)` / `.delete(id)` / `.has(id)` / `.clear()` with store setters.
2. In `src/stores/events.ts`:
   - Add `erroredSessions: string[]` to `EventsState`.
   - Add actions: `markErrored(sessionID)`, `clearErrored(sessionID?)`.
   - Replace direct `erroredSessions` mutations.
3. Update all call sites:
   - `sessions.ts:456` → `set((s) => ({ abortedSessions: [...s.abortedSessions, session.id] }))` (or use action).
   - `events.ts:290` → clear via action on busy.
   - `events.ts:402` → mark via action on `session.error`.
   - `events.ts:557-558` → clear both via actions in `disconnect()`.
4. Remove the `export const abortedSessions` module-level export and update any importers (search for `import { abortedSessions }`).
5. Run `bun run typecheck`.

**Risk:** Low-medium. The Sets are small and read-heavy; converting to arrays or keeping as Sets inside Zustand state both work. Prefer arrays for serializability and React render triggers, or keep as Set if read perf matters (it doesn't at this scale).

---

## Execution Order

| # | Item | Dependencies | Effort |
|---|------|-------------|--------|
| 1 | Android XML rules | None | 10 min |
| 2 | `formatReportForSupport` in `shareReport` | None | 5 min |
| 5 | Zustand Sets | None | 30 min |
| 4 | Extract modals | None | 1 h |
| 3 | WebSocket auth header | **Server support confirmed** | 1–2 h |

Items 1, 2, and 5 are safe to execute in parallel. Item 3 must wait for the server-capability check. Item 4 is independent but large.
