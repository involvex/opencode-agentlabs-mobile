# Plan: Fix Terminal Output Rendering (Malformed Lines)

## Problem

User reports: "the terminal has malformed output, like no new lines and such things."

The mobile app's `TerminalView` renders PTY/terminal output incorrectly. Output lines that should be on separate lines appear merged, overwritten, or jumbled.

## Root Cause Analysis

Investigation of `src/components/chat/TerminalView.tsx` and `src/lib/pty-ws.ts` reveals three concrete bugs:

### 1. Carriage return (`\r`) not stripped (primary cause of "no new lines")

**File**: `src/components/chat/TerminalView.tsx` — `TerminalSocket` (lines 95–117)

```js
const lines = chunk.split("\n");
```

The server sends PTY output containing `\r\n` (CRLF) or bare `\r` (carriage return). Splitting only on `\n` leaves `\r` at the end of every line. React Native's `Text` component treats `\r` as a control character that moves the cursor back to column 0, so all text on a given visual line overwrites what came before. This makes multi-line output collapse into what looks like a single garbled line.

### 2. Unstable React list keys

**File**: `src/components/chat/TerminalView.tsx` — `AnsiLine` (line 188)

```js
key={line.slice(0, 32)}
```

- Empty lines produce an empty string key (`""`), so all empty lines collide.
- Distinct lines that share the same first 32 characters collide.
- React cannot reliably reconcile the list, causing lines to disappear, reorder, or merge.

### 3. Local terminal has the same `\r` bug

**File**: `src/components/chat/TerminalView.tsx` — `LocalTerminalView` (lines 287–289)

```js
const lines = [result.stdout, result.stderr].filter(Boolean).join("\n");
setOutput((prev) => [...prev, ...lines.split("\n")]);
```

`executeLocalCommand` returns strings with platform-native line endings. On Android (Linux), this is typically `\n`, but if the executed command or native bridge introduces `\r`, the same overwrite problem occurs.

## Fix Plan

### Task 1: Normalize line endings in `TerminalSocket`

Strip `\r` from each line after splitting the WebSocket chunk.

**Before**:
```js
const lines = chunk.split("\n");
if (lines.length === 1) {
  if (next.length > 0) {
    next[next.length - 1] += lines[0];
  } else {
    next.push(lines[0]);
  }
} else {
  if (next.length > 0) {
    next[next.length - 1] += lines[0];
  } else {
    next.push(lines[0]);
  }
  for (let i = 1; i < lines.length; i++) {
    next.push(lines[i]);
  }
}
```

**After**:
```js
const rawLines = chunk.split("\n");
const lines = rawLines.map((l) => l.replace(/\r$/, ""));
if (lines.length === 1) {
  if (next.length > 0) {
    next[next.length - 1] += lines[0];
  } else {
    next.push(lines[0]);
  }
} else {
  if (next.length > 0) {
    next[next.length - 1] += lines[0];
  } else {
    next.push(lines[0]);
  }
  for (let i = 1; i < lines.length; i++) {
    next.push(lines[i]);
  }
}
```

### Task 2: Fix unstable React keys in `TerminalSocket` and `LocalTerminalView`

Replace `key={line.slice(0, 32)}` with a stable key that includes the array index or full line content.

**Option A (recommended)**: Use full line text + index as key.
```js
{output.map((line, idx) => (
  <AnsiLine
    key={`${line}-${idx}`}
    text={line}
    ...
  />
))}
```

**Option B**: If lines can be very long, hash the content.
```js
key={line.length === 0 ? `empty-${idx}` : line}
```

Option A is simpler and correct for a terminal output list where lines are append-only.

### Task 3: Normalize line endings in `LocalTerminalView`

Apply the same `\r` stripping when splitting local command output.

**Before**:
```js
const lines = [result.stdout, result.stderr].filter(Boolean).join("\n");
if (lines) {
  setOutput((prev) => [...prev, ...lines.split("\n")]);
}
```

**After**:
```js
const lines = [result.stdout, result.stderr].filter(Boolean).join("\n");
if (lines) {
  const normalized = lines.split("\n").map((l) => l.replace(/\r$/, ""));
  setOutput((prev) => [...prev, ...normalized]);
}
```

### Task 4: Add an output line cap (defensive)

Add a max line cap (e.g., 2000 lines) to prevent unbounded memory growth during long sessions.

```js
const MAX_LINES = 2000;
setOutput((prev) => {
  const next = [...prev, ...normalized];
  if (next.length > MAX_LINES) {
    return next.slice(next.length - MAX_LINES);
  }
  return next;
});
```

### Task 5: Add tests

Add unit tests for the line-normalization logic in `TerminalView` or a new test file:
- `\r\n` chunks produce distinct lines without trailing `\r`
- Bare `\r` in output is stripped
- Empty chunks / empty lines are handled
- React keys are unique for distinct lines

## Validation

1. Build the app (`bun run build` or `npx expo run:android`)
2. Open the terminal in the app against a server PTY
3. Run commands that produce `\r\n` output (e.g., `echo -e "line1\r\nline2\r\nline3"` or commands on Windows)
4. Verify each line appears on its own row, no overwriting
5. Verify empty lines render correctly
6. Verify long output doesn't crash or slow down

## Out of Scope

- Full VT100/ANSI escape sequence parsing (cursor movement, screen clearing, colors). The existing `ansi-to-style.ts` handles SGR color codes; cursor movement sequences are a larger project.
- Local terminal native module changes. The fix is on the JS rendering side.
