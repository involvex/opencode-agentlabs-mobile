# Plan: Strip Non-SGR ANSI Escapes from Terminal Output

## Problem

Terminal still shows raw ANSI escape fragments like `[23;` in rendered output. These are non-SGR CSI sequences (DEC private modes, incomplete CSIs, etc.) that leak through `ansi-to-style.ts` and reach React Native `Text` as literal characters.

## Root Cause

**File**: `src/lib/ansi-to-style.ts`

1. **Non-SGR escapes not stripped**: `ANSI_ESCAPE = /\033\[[0-9;]*m/g` only matches SGR sequences ending with `m`. DEC private mode (`\033[?...`), OSC (`\033]...`), cursor movement, and incomplete CSIs (`\033[23;`) are unmatched and fall through to the text branch.

2. **SGR parameters consumed by `split`**: `raw.split(ANSI_ESCAPE)` removes the entire escape including parameters. The post-split parts array contains only plain text, so `/^[0-9;]+$/` never matches. SGR colors/styles have been silently no-op all along.

## Fix Plan

### Task 1: Add non-SGR ANSI stripping to `ansi-to-style.ts`

Add a pre-processing step that strips all ANSI escapes except SGR before tokenization:

```ts
const NON_SGR_ANSI = new RegExp(
  "(?:" +
    ESC + "\\][^\\x07\\x1b]*(?:\\x07|\\x1b\\\\)" + // OSC ... BEL or ST
    "|" +
    ESC + "\\[[0-9;?]*[A-Za-ln-z]" + // CSI ending with any letter except m
    "|" +
    ESC + "\\[[0-9;]*$" + // trailing incomplete CSI at end of string
  ",
  "g",
);

function stripNonSgr(raw: string): string {
  return raw.replace(NON_SGR_ANSI, "");
}
```

### Task 2: Rewrite `ansiToSegments` tokenizer

Replace `String.split()` with an iterator-based tokenizer that matches all CSI sequences and processes SGR parameters directly:

```ts
const ALL_CSI = new RegExp(`${ESC}\\[[0-9;]*[A-Za-z]`, "g");

export function ansiToSegments(raw: string, isDark: boolean): AnsiSegment[] {
  const cleaned = stripNonSgr(raw);
  const segments: AnsiSegment[] = [];
  let currentText = "";
  let currentFg = isDark ? DEFAULT_FG_DARK : DEFAULT_FG_LIGHT;
  let currentBg = isDark ? DEFAULT_BG_DARK : DEFAULT_BG_LIGHT;
  let bold = false, dim = false, italic = false, underline = false;
  let lastIndex = 0;
  let match;

  while ((match = ALL_CSI.exec(cleaned)) !== null) {
    const textBefore = cleaned.slice(lastIndex, match.index);
    if (textBefore) currentText += textBefore;

    const escape = match[0];
    if (escape.endsWith("m")) {
      const paramStr = escape.slice(escape.indexOf("[") + 1, -1);
      const codes = paramStr.split(";").map(Number);
      for (const code of codes) {
        // ... same switch logic as current code
      }
      if (currentText) {
        segments.push({ text: currentText, style: buildStyle(...) });
        currentText = "";
      }
    }
    lastIndex = match.index + match[0].length;
  }

  const remaining = cleaned.slice(lastIndex);
  if (remaining) currentText += remaining;
  if (currentText) {
    segments.push({ text: currentText, style: buildStyle(...) });
  }

  return segments.length > 0 ? segments : [{ text: cleaned, style: { color: currentFg } }];
}
```

### Task 3: Add tests for `ansiToSegments`

New `src/lib/ansi-to-style.test.ts`:
- SGR `\033[31m` produces red segment
- Non-SGR `\033[?900` is stripped, not rendered
- Incomplete CSI `\033[23;` is stripped
- OSC `\033]0;title\x07` is stripped
- Mixed SGR + non-SGR in same string
- Empty input returns single default segment
- Multiple SGR codes in one sequence (`\033[1;31m`)

### Task 4: Verify TerminalView renders cleanly

No changes needed to `TerminalView.tsx` — `AnsiLine` already calls `ansiToSegments`. After the fix, raw escapes will be stripped before segments are produced.

## Validation

1. `bun run test` — new `ansi-to-style.test.ts` passes
2. `bun run lint` / `bun run typecheck` pass
3. Run the app, open terminal against server PTY
4. Run `echo -e "\033[?900\033[23;\033[31mred\033[0m"` — verify `[23;` and `?900` do not appear, `red` appears in red
5. Run a command that produces normal output — verify no regression

## Out of Scope

- Full VT100 emulation (cursor movement, screen clears, scrollback). This fix only strips unhandled escapes; it does not implement terminal semantics.
- Local terminal path uses the same `AnsiLine` renderer, so it benefits automatically.
