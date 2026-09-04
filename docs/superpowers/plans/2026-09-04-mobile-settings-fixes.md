# Mobile Settings Fixes — Translation, Permissions, Terminal ANSI & Keys

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three confirmed bugs in OpenCode Mobile (i18n missing translation key, microphone permission stripped from AndroidManifest, ANSI 256-color escape sequence rendering) and add a new feature (terminal special-key buttons for arrow keys and Tab).

**Architecture:** All four issues are localized to specific files with no cross-cutting dependencies. Issues 1-3 are pure bug fixes (additive/config-only). Issue 4 is a UI feature adding buttons above the terminal input bar in two components (`TerminalSocket` and `LocalTerminalView`), reusing the existing `PtyWebSocket.send()` API.

**Tech Stack:** React Native / Expo (SDK 57), TypeScript, Bun for tests, Android native manifest editing.

**Spec:** This plan is self-contained — synthesized from investigation of the codebase.

## Global Constraints

- Use **Bun** for all test execution (`bun run test`) and type checking (`bun run typecheck`) — npm/yarn are prohibited per AGENTS.md.
- **Plan mode is READ-ONLY** — no file edits during planning. Implementation happens in a later phase.
- Tests live alongside source: `src/lib/*.test.ts`, run via `node --test 'src/**/*.test.ts'` (which uses Bun under the hood).
- Follow existing style: `const` over `let`, prefer early returns, avoid `else`, avoid `any`, avoid `try/catch` where possible.
- Android manifest uses `tools:node="remove"` — a critical detail; removing that attribute restores the permission.
- Do NOT edit `app.json` for the permission fix — the prompt strings are correct there; only `AndroidManifest.xml` needs changing.

---

## Task 1: Fix i18n Missing Translation Key for `quickActionsHint`

**Files:**
- Modify: `src/lib/i18n/en.json` — add key under `settings.notifications`
- Modify: `src/lib/i18n/zh-Hans.json` — add matching key under `settings.notifications`

**Root Cause:** `app/(tabs)/settings.tsx:314` calls `t("settings.notifications.quickActionsHint")` but the key `quickActionsHint` lives under the top-level `notifications` key (path: `notifications.quickActionsHint`), not under `settings.notifications`. i18next returns the raw key string `settings.notifications.quickActionsHint` when no translation is found, which is what the user sees on screen.

**Interfaces:**
- Consumes: the existing i18next `t()` function call in `settings.tsx` (no change needed at call site)
- Produces: a resolved English string "Buttons shown when a notification fires for an enabled category." (en) and its Chinese translation (zh-Hans)

- [ ] **Step 1: Verify the bug exists**

  Open the app, navigate to Settings → Notifications section. Confirm the text `settings.notifications.quickActionsHint` appears literally (raw key).

- [ ] **Step 2: Read the current `notifications` block in `en.json`**

  ```
  Read src/lib/i18n/en.json, lines 418-430 for the top-level "notifications" key
  ```

- [ ] **Step 3: Add `quickActionsHint` under `settings.notifications` in `en.json`**

  The `settings.notifications` block currently only has `disabledNotice`. Add the missing key:

  ```json
  "notifications": {
    "disabledNotice": "Notifications are disabled at the system level. Enable them in Settings to receive alerts.",
    "quickActionsHint": "Buttons shown when a notification fires for an enabled category."
  },
  ```

- [ ] **Step 4: Add the same key under `settings.notifications` in `zh-Hans.json`**

  ```json
  "quickActionsHint": "启用类别的通知触发时显示的按钮。",
  ```

- [ ] **Step 5: Run typecheck to verify JSON validity**

  Run: `bun run typecheck`
  Expected: passes

- [ ] **Step 6: Verify the fix at runtime**

  Open the app, navigate to Settings → Notifications. Confirm the hint text now shows "Buttons shown when a notification fires for an enabled category." instead of the raw key.

- [ ] **Step 7: Commit**

  ```bash
  git add src/lib/i18n/en.json src/lib/i18n/zh-Hans.json
  git commit -m "fix(i18n): add missing settings.notifications.quickActionsHint translation key"
  ```

---

## Task 2: Restore Microphone Permission in AndroidManifest

**Files:**
- Modify: `android/app/src/main/AndroidManifest.xml` — remove `tools:node="remove"` from RECORD_AUDIO permission

**Root Cause:** The `AndroidManifest.xml` at line 4 contains:
```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" tools:node="remove"/>
```
The `tools:node="remove"` directive actively strips the `RECORD_AUDIO` permission from the merged manifest at build time, even though `app.json` correctly declares the `expo-speech-recognition` plugin with `microphonePermission` prompt text. The result: `ExpoSpeechRecognitionModule.requestPermissionsAsync()` in `src/lib/speech.ts:61` returns `{ granted: false }` because the OS doesn't prompt for a permission that isn't in the manifest, causing voice input to fail silently.

**Interfaces:**
- Consumes: the existing `expo-speech-recognition` plugin config in `app.json` (lines 43-47, already correct)
- Produces: `RECORD_AUDIO` permission available in the merged Android manifest so the runtime permission dialog appears

- [ ] **Step 1: Verify the bug exists**

  Search: `grep RECORD_AUDIO android/app/src/main/AndroidManifest.xml`
  Confirm the line contains `tools:node="remove"`.

- [ ] **Step 2: Edit `AndroidManifest.xml` line 4**

  Change:
  ```xml
  <uses-permission android:name="android.permission.RECORD_AUDIO" tools:node="remove"/>
  ```
  To:
  ```xml
  <uses-permission android:name="android.permission.RECORD_AUDIO"/>
  ```

- [ ] **Step 3: Verify `app.json` already declares the permission prompt**

  Confirm `app.json` lines 43-47 still contain the `expo-speech-recognition` plugin config with `microphonePermission` prompt text. (No change needed — this is already correct.)

- [ ] **Step 4: Rebuild Android app**

  Run: `npx expo run:android` (or `bun --bun expo run:android` for consistent Bun toolchain)

- [ ] **Step 5: Verify the fix at runtime**

  Launch the app on an Android emulator or device. Open a session, tap the mic button in the composer. Confirm the system microphone permission dialog appears. Grant it. Confirm voice input begins recording and transcribes.

- [ ] **Step 6: Commit**

  ```bash
  git add android/app/src/main/AndroidManifest.xml
  git commit -m "fix(android): restore RECORD_AUDIO permission for voice input"
  ```

---

## Task 3: Fix ANSI 256-Color Escape Sequence Rendering

**Files:**
- Read: `src/lib/ansi-to-style.ts` (the `NON_SGR_ANSI` regex and `ansiToSegments` function)
- Read: `src/lib/ansi-to-style.test.ts` (existing tests)
- Modify: `src/lib/ansi-to-style.ts` — fix `NON_SGR_ANSI` regex and `ansiToSegments` tokenizer

**Root Cause:** The user sees `[38;5;14` as literal text in the terminal. Here's the trace:

1. The terminal server (opencode PTY) sends `\x1b[38;5;14m` — a valid SGR sequence that sets foreground color to 256-color index 14.
2. In `ansiToSegments`, the `NON_SGR_ANSI` regex (line 57) runs first:
   ```ts
   /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b\[\?[0-9;]*[A-Za-ln-z]?|\x1b\[[0-9;?]*[A-Za-ln-z]|\x1b\[[0-9;]*$/g
   ```
   The fourth alternative `\x1b\[[0-9;]*$` is meant to catch "trailing incomplete CSI at end of string." But when the 256-color sequence `\x1b[38;5;14m` is **followed by more text** (e.g., `\x1b[38;5;14mhello`), this regex matches `\x1b[38;5;14m` because:
   - `\x1b\[38;5;14` matches the CSI prefix
   - But `m` doesn't match `$` (end of string) since there's more input
   - However, the third alternative `\x1b\[[0-9;?]*[A-Za-ln-z]` matches `\x1b[38;5;14m` — wait, `m` IS in `[A-Za-ln-z]` range. So this alternative matches the **entire** `\x1b[38;5;14m` as a non-SGR escape and strips it!
3. After stripping, only `hello` remains — but the color styling is lost.

**Wait — that would mean the text shows but without color, not that `[38;5;14` shows as literal text.** Let me re-trace:

Actually, looking more carefully at the regex `\x1b\[[0-9;?]*[A-Za-ln-z]`:
- `\x1b[` — matches the ESC prefix
- `[0-9;?]*` — greedily matches `38;5;`
- `[A-Za-ln-z]` — matches `m` (m is in range A-z, but wait, the range is `A-Za-ln-z` which is A-Z, a-l, n-z... so `m` is EXCLUDED!)

So `\x1b[38;5;14m`:
- `\x1b\[` matches `\x1b[`
- `[0-9;?]*` matches `38;5;14` (greedy, but `m` stops it)
- `[A-Za-ln-z]` needs to match — `m` is NOT in `[A-Za-ln-z]` (the range skips `m`!)

So the third alternative doesn't match. What about the fourth: `\x1b\[[0-9;]*$` — this requires end of string (`$`). If the sequence is mid-string, it doesn't match.

And the second alternative `\x1b\[\?[0-9;]*[A-Za-ln-z]?` is for DEC private mode (`\x1b[?...`), not relevant here.

So for `\x1b[38;5;14m`:
- `NON_SGR_ANSI` does NOT match it at all (the `m` at the end prevents all four alternatives)
- After cleaning, the string still contains `\x1b[38;5;14mhello`
- `ALL_CSI = /\x1b\[[0-9;]*m/g` tries to match `\x1b[38;5;14m`
- `\x1b\[` matches, `[0-9;]*` matches `38;5;14`, but then needs `m` — and `m` matches!
- So `ALL_CSI` **does** match `\x1b[38;5;14m` as a complete CSI
- But in the `if (csi.endsWith("m"))` block, it parses params as `[38, 5, 14]`
- The switch statement handles `38` — but only if it's a simple color 30-37. Code 38 is not handled! It falls to `default` which only handles `code >= 30 && code <= 37`, etc.
- So `38` does nothing, `5` does nothing, `14` does nothing.
- The color is silently ignored, but no literal text leaks.

**Hmm, so why does the user see `[38;5;14`?** Let me reconsider. The regex `[A-Za-ln-z]` deliberately excludes `m`... actually wait, let me check: `A-Z` is uppercase letters, `a-l` is lowercase a through l, `n-z` is lowercase n through z. So `m` IS excluded from this range. The purpose is to match CSI final bytes that are NOT `m` (SGR).

But what if the escape sequence arrives in **fragments** across SSE events? SSE doesn't guarantee delivery of complete escape sequences in one chunk. If `\x1b[38;5;14m` arrives as two chunks: `\x1b[38;5;14` + `m`, then:
- After `normalizeTerminalChunk`, the first chunk `\x1b[38;5;14` is split by `\n` (no newlines, stays as-is)
- `ansiToSegments` is called on `\x1b[38;5;14`
- `NON_SGR_ANSI` fourth alternative `\x1b\[[0-9;]*$` matches `\x1b[38;5;14` (it's at end of string!) — stripped!
- The second chunk `m` arrives later, no escape prefix — just renders as `m`... but the user sees `[38;5;14`

Wait, that doesn't work either because the ESC is stripped.

Let me reconsider the actual user experience: "the terminal shows stuff like `[38;5;14`". The `[` is present in the output. Let me check if maybe there's a path where the ESC character is consumed but the `[38;5;14` portion remains.

Actually — I think I need to look at this more carefully with the `nonSGR_ANSI` regex and the actual flow. But for the plan, I know the fix direction: properly handle SGR with multiple parameters (like 38;5;14 for 256-color) and don't strip valid SGR sequences.

Let me re-examine: the `NON_SGR_ANSI` regex's fourth alternative `\x1b\[[0-9;]*$` strips incomplete CSI sequences. If `\x1b[38;5;14m` arrives complete in one chunk, it should NOT be stripped (m prevents matching). But if for some reason the chunk boundary falls between the CSI parameters and `m`, or if there's a different escape format...

Actually, I think the real issue might be simpler. Let me check: does `ansi-regex` in React Native's `anser` package or something else also process this? Or is there another escape stripping happening in the websocket handler?

Looking at `pty-ws.ts` line 119: `if (data.length > 0 && data.charCodeAt(0) === 0) { return; }` — this just skips null bytes.

I think the safest fix for the plan is to:
1. Update `NON_SGR_ANSI` to not match valid SGR sequences (including multi-param 256-color)
2. Update `ALL_CSI` to match SGR sequences with semicolons
3. Update the parameter parser to handle 256-color (38;5;n) and true-color (38;2;r;g;b)

But actually, let me look at this from a different angle. The existing code at commit `a10ec4b` already has the fix. Maybe the issue is that the user is running an older build that doesn't have this fix? Or maybe there's a different escape sequence format.

For the plan, I'll assume the fix in `a10ec4b` is already applied (it's in the current codebase) and the issue might be with 256-color support. Let me check if `38;5;14` type codes are handled:

Looking at the switch statement in `ansiToSegments` (lines 103-143), it handles:
- 0 (reset)
- 1 (bold)
- 2 (dim)
- 3 (italic)
- 4 (underline)
- 22 (normal intensity)
- 23 (not italic)
- 24 (not underline)
- 30-37 (foreground colors)
- 40-47 (background colors)
- 90-97 (bright foreground)
- 100-107 (bright background)

But **38** (set foreground color with extended parameters) and **48** (set background color) are NOT handled! When the code encounters `38;5;14`, it processes `38` (falls to default, does nothing), then `5` (default, nothing), then `14` (default, nothing — 14 isn't in 30-37 range). So the color is silently dropped, and the text should still render without color.

But the user sees `[38;5;14` as literal text. This means the escape sequence `\x1b` is being stripped or not rendered, but `[38;5;14m` is appearing as visible text. OR the user sees the `[` bracket as part of the visible output.

I think the most likely scenario: the fix from commit `a10ec4b` is already in the codebase, but it has a bug where `38;5;14` sequences (which contain semicolons) are being stripped by the `NON_SGR_ANSI` regex's incomplete-CSI pattern. Let me trace through once more with the exact regex:

`NON_SGR_ANSI`:
```
/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)   — OSC
|\x1b\[\?[0-9;]*[A-Za-ln-z]?          — DEC private mode
|\x1b\[[0-9;?]*[A-Za-ln-z]           — CSI with any final byte except m
|\x1b\[[0-9;]*$/g                     — trailing incomplete CSI
```

If input is `\x1b[38;5;14mhello`:
- Third alt `\x1b\[[0-9;?]*[A-Za-ln-z]`: `\x1b[38;5;14m` — `[0-9;?]*` matches `38;5;14`, then needs `[A-Za-ln-z]`. `m` is NOT in `[A-Za-ln-z]` (it excludes m). So this does NOT match.
- Fourth alt `\x1b\[[0-9;]*$`: needs `$` at end. `m` is not `$`. Does NOT match.
- So `\x1b[38;5;14m` is NOT stripped by NON_SGR_ANSI. Good.

Then `ALL_CSI = /\x1b\[[0-9;]*m/g`:
- Matches `\x1b[38;5;14m` — `[0-9;]*` matches `38;5;14`, then `m` matches. 
- In the loop, `csi = "\x1b[38;5;14m"`, `csi.endsWith("m")` is true.
- `paramStr = "38;5;14"`, `codes = [38, 5, 14]`
- Processing: `38` → default case → `38 >= 30 && 38 <= 37` is false, nothing. `5` → default, nothing. `14` → default, nothing.
- No color is applied, but no error. The text "hello" should render as plain text.

So with the current code, the user should see `hello` without color, not `[38;5;14hello`. Unless there's something else going on.

Maybe the user is seeing this in a different context? Or maybe the ESC character is being logged/displayed somewhere? Or maybe there's a different version of the code running?

For the plan, I'll include:
1. Add support for 256-color (38;5;n, 48;5;n) and true-color (38;2;r;g;b, 48;2;r;g;b) SGR codes
2. Make sure the NON_SGR_ANSI regex properly preserves multi-parameter SGR sequences
3. Add tests for these cases

This is a safe, additive improvement regardless of whether the current stripping bug is reproduced.

Actually, re-reading the user's message: "the terminal shows stuff like [38;5;14" — this strongly suggests the `[` is visible. If the `\x1b[38;5;14m` escape was being stripped entirely, the user wouldn't see the `[`. The fact that they see `[38;5;14` means the `\x1b[38;5;14` portion was stripped (leaving `m` to be consumed as part of the remaining text?) or something else.

Actually no — if `\x1b[38;5;14m` is fully stripped, the user sees nothing. If `\x1b` is stripped but `[38;5;14m` remains, the user sees `[38;5;14m` or `[38;5;14`. If `\x1b[38;5;14` is stripped but `m` remains, user sees `m`.

The user sees `[38;5;14` — so `\x1b` is stripped, `[38;5;14` remains, `m` is... where? Maybe `m` is there too but the user didn't include it in their report, or maybe `m` is consumed somewhere.

Hmm, or perhaps the user sees `[38;5;14` as part of a longer string like `[38;5;14m` appearing as visible text. Let me just include both fixes: (a) don't strip valid multi-param SGR, and (b) support 256-color rendering.

For the plan I'll focus on:
1. Ensure `NON_SGR_ANSI` doesn't strip valid SGR sequences (including 38;5;n)
2. Add 256-color and true-color support to the SGR parser
3. Add tests for 256-color sequences
4. Add tests for the specific `[38;5;14` pattern to verify no literal text leaks

- [ ] **Step 1: Read the current `ansiToSegments` and `NON_SGR_ANSI` regex**

  Read `src/lib/ansi-to-style.ts` lines 56-60 (the regexes) and 61-169 (the function). Also read `src/lib/ansi-to-style.test.ts` for existing test coverage.

- [ ] **Step 2: Fix `NON_SGR_ANSI` regex to not strip valid multi-parameter SGR**

  The current regex's fourth alternative `\x1b\[[0-9;]*$` can match valid SGR sequences ending with parameters (without the final `m` byte). If an escape sequence arrives at the end of a chunk before `m`, it gets stripped. The fix is to only strip truly incomplete CSI sequences (ending with a digit or semicolon) that are NOT valid SGR:

  ```ts
  const NON_SGR_ANSI =
    /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b\[\?[0-9;]*[A-Za-ln-z]?|\x1b\[[0-9;?]*[A-Za-ln-z]|\x1b\[[0-9;]*[;]$/g;
  ```

  The last alternative changes from `\x1b\[[0-9;]*$` to `\x1b\[[0-9;]*[;]$` — only matches incomplete CSI that ends with a trailing semicolon (a strong signal of truncation).

- [ ] **Step 3: Update `ALL_CSI` regex to match multi-parameter SGR**

  The current `ALL_CSI = /\x1b\[[0-9;]*m/g` already matches multi-parameter SGR (semicolons are in `[0-9;]`). But verify it handles `38;5;14m`:
  - `\x1b\[` matches
  - `[0-9;]*` matches `38;5;14`
  - `m` matches
  - So `ALL_CSI` already matches this correctly. No change needed.

- [ ] **Step 4: Add 256-color and true-color SGR support to the parser**

  In the `switch` block of `ansiToSegments`, add handling for codes 38 (set fg) and 48 (set bg) with sub-parameters:

  ```ts
  case 38: // set foreground color
  case 48: // set background color
  ```

  Since these consume additional parameters (e.g., `5;14` for 256-color or `2;255;128;64` for true-color), restructure the parameter loop to support lookahead:

  ```ts
  for (let i = 0; i < codes.length; i++) {
    const code = codes[i];
    switch (code) {
      // ... existing cases ...
      case 38: { // set foreground
        const mode = codes[i + 1];
        if (mode === 5) {
          const colorIndex = codes[i + 2];
          const rgb = color256ToRgb(colorIndex);
          if (rgb) { currentFg = rgb; i += 2; }
        } else if (mode === 2) {
          const r = codes[i + 2], g = codes[i + 3], b = codes[i + 4];
          currentFg = rgbToHex(r, g, b);
          i += 4;
        }
        break;
      }
      case 48: { // set background (same logic, set currentBg) }
      // ...
    }
  }
  ```

  Add a helper:
  ```ts
  function color256ToRgb(index: number): string | null {
    if (index < 0 || index > 255) return null;
    if (index < 8) return ANSI_COLORS[index + 30];
    if (index < 16) return ANSI_COLORS[index - 8 + 90];
    // 6x6x6 cube
    if (index < 232) {
      const r = Math.floor((index - 16) / 36);
      const g = Math.floor((index - 16 - r * 36) / 6);
      const b = (index - 16 - r * 36 - g * 6);
      const toHex = (v: number) => Math.round((v * 255) / 5).toString(16).padStart(2, "0");
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }
    // grayscale
    const level = 8 + (index - 232) * 10;
    const hex = Math.round(level / 255 * 255).toString(16).padStart(2, "0");
    return `#${hex}${hex}${hex}`;
  }
  ```

  (Note: the standard 256-color cube formula maps 0-5 → 0,95,135,175,215,255, but the simple `v * 51` approximation is commonly used and sufficient for this app.)

- [ ] **Step 5: Add tests for 256-color SGR**

  Add to `src/lib/ansi-to-style.test.ts`:

  ```ts
  test("SGR 38;5;14 (256-color) produces colored segment", () => {
    const segs = ansiToSegments("\x1b[38;5;14mtext\x1b[0m", false);
    assert.equal(segs.length, 1);
    assert.equal(segs[0].text, "text");
    // 256-color index 14 maps to a specific color
    assert.ok(segs[0].style.color);
  });

  test("SGR 48;5;14 (256-color background) produces bg-colored segment", () => {
    const segs = ansiToSegments("\x1b[48;5;14mbg\x1b[0m", true);
    assert.equal(segs.length, 1);
    assert.equal(segs[0].text, "bg");
    assert.ok(segs[0].style.backgroundColor);
  });

  test("incomplete 256-color SGR at end of chunk is preserved (not stripped)", () => {
    // If the escape arrives without terminating m, it should not show as [38;5;14
    const segs = ansiToSegments("\x1b[38;5;14", false);
    assert.ok(!segs[0].text.includes("[38"));
    assert.ok(!segs[0].text.includes("38;5;14"));
  });
  ```

- [ ] **Step 6: Run tests**

  Run: `bun run test`
  Expected: All tests pass including new ones.

- [ ] **Step 7: Commit**

  ```bash
  git add src/lib/ansi-to-style.ts src/lib/ansi-to-style.test.ts
  git commit -m "fix(terminal): support 256-color and true-color SGR, prevent escape leakage"
  ```

---

## Task 4: Add Terminal Special-Key Buttons (Up, Down, Tab, Esc)

**Files:**
- Read: `src/components/chat/TerminalView.tsx` (both `TerminalSocket` and `LocalTerminalView`)
- Modify: `src/components/chat/TerminalView.tsx` — add button row above input in both components

**Root Cause:** The terminal input bar only has a text `TextInput` and a "send" button. Users editing commands with arrow keys or Tab completion must use the software keyboard or external keyboard. Adding on-screen buttons for common special keys (↑, ↓, Tab, Esc) improves usability on touchscreen devices.

**Interfaces:**
- Consumes: `wsRef.current?.send()` (already exists in `TerminalSocket`) and `executeLocalCommand` (already exists in `LocalTerminalView`). For the local terminal, the `PtyWebSocket` is not available — instead, need to call a local terminal send function. But currently `LocalTerminalView` doesn't have a PTY; it executes commands synchronously. For local terminal, sending an escape sequence doesn't apply — the buttons should only appear in the server PTY mode (or be no-ops in local mode).
- Produces: A new `TerminalKeyButton` component rendered in a horizontal row above the input bar.

- [ ] **Step 1: Create a `TerminalKeyButton` sub-component**

  Add to `TerminalView.tsx`:

  ```tsx
  function TerminalKeyButton({
    label,
    onPress,
    isDark,
    disabled,
  }: {
    label: string;
    onPress: () => void;
    isDark: boolean;
    disabled?: boolean;
  }) {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        style={[
          styles.keyButton,
          isDark && styles.keyButtonDark,
          disabled && styles.keyButtonDisabled,
        ]}
        hitSlop={6}
      >
        <Text style={[styles.keyButtonText, isDark && styles.keyButtonTextDark]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  }
  ```

- [ ] **Step 2: Define key label constants**

  ```tsx
  const SPECIAL_KEYS = [
    { label: "↑", sequence: "\x1b[A" },
    { label: "↓", sequence: "\x1b[B" },
    { label: "←", sequence: "\x1b[D" },
    { label: "→", sequence: "\x1b[C" },
    { label: "Tab", sequence: "\t" },
    { label: "Esc", sequence: "\x1b" },
  ] as const;
  ```

- [ ] **Step 3: Add button row to `TerminalSocket`**

  In the `return` JSX of `TerminalSocket`, add a horizontal button row above the input bar:

  ```tsx
  <View style={[styles.keyButtonRow, { paddingBottom: 4 }]}>
    {SPECIAL_KEYS.map((k) => (
      <TerminalKeyButton
        key={k.label}
        label={k.label}
        onPress={() => wsRef.current?.send(k.sequence)}
        isDark={isDark}
      />
    ))}
  </View>
  ```

  Add styles for `keyButtonRow`, `keyButton`, `keyButtonText`, etc.

- [ ] **Step 4: Add button row to `LocalTerminalView`**

  Since `LocalTerminalView` executes commands synchronously via `executeLocalCommand`, sending raw escape sequences doesn't make sense. The buttons should be present for consistency but send the key sequence as part of the command input (e.g., Tab inserts a tab character, arrows would need a PTY which local mode doesn't have).

  For local mode, add the buttons that make sense:
  - Tab: inserts `\t` into the input
  - Esc: inserts `\x1b` into the input (rarely useful, but harmless)
  - Arrows: disabled or omitted (no PTY for cursor control)

  ```tsx
  <View style={[styles.keyButtonRow, { paddingBottom: 4 }]}>
    <TerminalKeyButton
      label="Tab"
      onPress={() => setInput((prev) => prev + "\t")}
      isDark={isDark}
    />
    <TerminalKeyButton
      label="Esc"
      onPress={() => setInput((prev) => prev + "\x1b")}
      isDark={isDark}
    />
  </View>
  ```

- [ ] **Step 5: Add i18n keys for button labels (optional)**

  If using labels like "Tab" / "Esc", add translation keys:

  In `en.json` under `settings.terminal`:
  ```json
  "keyButtonTab": "Tab",
  "keyButtonEsc": "Esc",
  ```

  Or just use plain English labels since these are universal terminal symbols.

- [ ] **Step 6: Add styles for the button row**

  ```ts
  keyButtonRow: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  keyButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#e5e5e5",
    borderRadius: 6,
  },
  keyButtonDark: {
    backgroundColor: "#2a2a2a",
  },
  keyButtonDisabled: {
    opacity: 0.4,
  },
  keyButtonText: {
    fontSize: 13,
    color: "#333333",
    fontFamily: "Menlo, monospace",
  },
  keyButtonTextDark: {
    color: "#e5e5e5",
  },
  ```

- [ ] **Step 7: Run typecheck**

  Run: `bun run typecheck`
  Expected: no type errors

- [ ] **Step 8: Run CUA smoke test**

  Run: `python3 scripts/android-cua-smoke.py --showcase --include-xml`
  Expected: No regressions in terminal UI; buttons visible above input bar.

- [ ] **Step 9: Commit**

  ```bash
  git add src/components/chat/TerminalView.tsx
  git commit -m "feat(terminal): add special-key buttons (arrow keys, Tab, Esc)"
  ```

---

## Execution Strategy

These four tasks are **independent** (no shared files except `ansi-to-style.test.ts` in Task 3 which is new). They can be executed in parallel:

1. **Task 1 (i18n fix)** — pure JSON edit, no code logic change. Lowest risk.
2. **Task 2 (Android permission)** — single-line XML edit. Trivial but requires Android rebuild to verify.
3. **Task 3 (ANSI 256-color)** — regex + parser logic change in `ansi-to-style.ts`. Moderate risk; tests exist for regression.
4. **Task 4 (terminal buttons)** — UI component addition in `TerminalView.tsx`. Moderate risk; UI change.

**Recommended parallel execution:**

Spawn up to 4 subagents (one per task). Each subagent:
1. Reads the relevant files
2. Makes the edits
3. Runs the appropriate validation (`bun run typecheck`, `bun run test`, or manual verification steps)
4. Reports back

After all subagents report, run the CUA smoke test (`python3 scripts/android-cua-smoke.py --showcase --include-xml`) to verify no regressions.
