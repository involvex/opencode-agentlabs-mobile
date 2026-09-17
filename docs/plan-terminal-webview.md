# Plan: Replace Terminal TextInput with xterm.js WebView Terminal

## Problem

The current terminal input in `TerminalView.tsx` uses a plain React Native `<TextInput>` component. This means:
- Shell tab completions don't work (Tab key events are sent as literal characters or not at all)
- No proper cursor positioning or line editing
- No support for terminal escape sequences for input
- The shell receives input only after pressing Enter (no interactive completion)

## Solution

Replace the server-terminal input with a proper terminal emulator using **xterm.js rendered inside a `<WebView>`**. The WebView will:
1. Load xterm.js (from CDN or bundled)
2. Connect directly to the existing `PtyWebSocket`
3. Render ANSI output with proper terminal emulation
4. Handle all keyboard input natively (Tab completions, arrow keys, etc.)
5. Maintain the existing PTY WebSocket connection

## Architecture

```
Current:
  User → TextInput → handleSend() → wsRef.current.send(text + "\r") → WebSocket → PTY

Proposed:
  User → WebView (xterm.js) → onData → WebSocket → PTY
  PTY → WebSocket → onMessage → WebView → xterm.js render
```

## Files to Create/Modify

### 1. New: `src/components/chat/TerminalWebView.tsx`
- Wraps `react-native-webview` `<WebView>`
- Loads an HTML page containing xterm.js
- Provides a JavaScript bridge for:
  - Sending input data to the WebSocket (`ws.send(data)`)
  - Receiving WebSocket messages and writing to xterm.js (`term.write(data)`)
  - Resizing the terminal on layout changes
  - Focus management
- Uses the existing `PtyWebSocket` class for WebSocket communication

### 2. New: `src/components/chat/terminal-webview.html`
- HTML page loaded in the WebView
- Contains xterm.js (loaded from CDN or bundled JS)
- Sets up xterm.js with fit addon
- Bridges JavaScript ↔ Native via `window.ReactNativeWebView.postMessage`
- Handles `onData` callback to send input back to native

### 3. Modified: `src/components/chat/TerminalView.tsx`
- In `TerminalSocket` component, replace the `<TextInput>` + special key buttons + `<ScrollView>` with `<TerminalWebView>`
- Keep the `TerminalSocket` state management (WebSocket connection, output buffer) but delegate rendering to the WebView
- Preserve the `LocalTerminalView` as-is (local terminal doesn't need WebView)
- Remove or deprecate the special key button rows (xterm.js handles these natively)

### 4. Modified: `package.json`
- Add `"react-native-webview"` dependency via `npx expo install react-native-webview`

### 5. Modified: `app.json`
- Add `"react-native-webview"` to the plugins array

### 6. Potentially Modified: `src/lib/pty-ws.ts`
- Minor adjustments if the bridge needs specific message formats

## Technical Details

### WebView ↔ Native Bridge

The WebView uses `window.ReactNativeWebView.postMessage(message)` to send data to native React Native code.

Native code passes data to the WebView via `webViewRef.current?.injectJavaScript(...)`.

Message protocol:
```json
// Native → WebView (write to terminal)
{"type": "output", "data": "ANSI string"}

// Native → WebView (resize)
{"type": "resize", "cols": 80, "rows": 24}

// WebView → Native (user input)
{"type": "input", "data": "command text"}

// WebView → Native (ready)
{"type": "ready"}
```

### xterm.js Loading

Options:
- **CDN**: Load from a CDN in the HTML (simpler, but requires internet)
- **Bundled**: Bundle xterm.js as a local asset (more reliable, larger app size)

Recommendation: Bundle xterm.js locally for reliability. The HTML file will load it from the local assets.

### ANSI Rendering

xterm.js handles ANSI rendering natively, so the existing `ansiToSegments.ts` and `terminal-lines.ts` pipelines become unnecessary for the server terminal. The `AnsiLine` component approach is replaced by xterm.js's built-in parser.

### Dark/Light Theme

xterm.js supports themes:
```js
const theme = isDark ? {
  background: '#0a0a0a',
  foreground: '#e5e5e5',
  cursor: '#ffffff',
  // ... color palette
} : {
  background: '#ffffff',
  foreground: '#1a1a1a',
  cursor: '#000000',
  // ... color palette
};
term.options.theme = theme;
```

### Font Size

xterm.js `fontSize` option maps to the existing `terminalFontSize` setting.

### Keyboard Handling

xterm.js in WebView handles all keyboard input natively:
- Tab → sends `\t` to PTY (triggers shell completion)
- Arrow keys → send escape sequences to PTY
- Ctrl+C → sends `\x03`
- Backspace/Delete → sends appropriate escape sequences
- No need for special key buttons in the UI

### Special Key Buttons

The special key button rows (`SPECIAL_KEYS_NAV`, `SPECIAL_KEYS_CTRL`) can be removed from the server terminal since xterm.js handles these natively. They may be kept as optional overlay buttons for accessibility.

### WebSocket Communication

The existing `PtyWebSocket` class continues to work. The bridge layer sits between it and the WebView:
```
PtyWebSocket → Bridge (React Native) → postMessage → WebView → xterm.js
WebSocket message ← Bridge ← postMessage ← WebView → xterm.js input
```

### Connection Lifecycle

- `TerminalSocket` manages WebSocket lifecycle (connect, disconnect, reconnect)
- On connect: send any pending output to the WebView via `injectJavaScript`
- On message: write to xterm.js via `postMessage`
- On close: notify WebView to show disconnected state

### Local Terminal Mode

The `LocalTerminalView` continues to use the existing `TextInput` approach since:
1. It doesn't connect to a WebSocket PTY
2. It executes commands via the native `LocalTerminal` module
3. Shell completions are less relevant for the local mode (it runs commands sequentially)

### Error Handling

- If the WebView fails to load xterm.js: show error UI with retry
- If the WebSocket disconnects: show disconnected indicator (already exists)
- If the WebView crashes: fall back to the old TextInput terminal or show error

## Step-by-Step Implementation

### Step 1: Install Dependencies
```bash
npx expo install react-native-webview
```

### Step 2: Configure app.json
Add `react-native-webview` to plugins array.

### Step 3: Create TerminalWebView Component
Create `src/components/chat/TerminalWebView.tsx` that:
1. Accepts the same props as `TerminalSocket`
2. Creates a `<WebView>` with the xterm.js HTML
3. Implements the JS ↔ Native bridge
4. Handles resize, focus, and theme

### Step 4: Create xterm.js HTML Page
Create `src/components/chat/terminal-webview.html` with:
1. xterm.js loaded (bundled or CDN)
2. Terminal setup with theme
3. Bridge code for `postMessage` communication
4. `onData` handler to send input back

### Step 5: Update TerminalView.tsx
In `TerminalSocket`:
1. Replace the entire input section (TextInput + special keys + ScrollView) with `<TerminalWebView>`
2. Keep the header and WebSocket state management
3. Remove the `AnsiLine` component usage (xterm.js handles rendering)

### Step 6: Test
1. Verify WebSocket connection works through the WebView
2. Verify shell tab completions work
3. Verify ANSI rendering works
4. Verify dark/light theme switching
5. Verify keyboard input (Tab, arrows, Ctrl+C) works
6. Verify the local terminal mode still works

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Android keyboard double-Enter issue with xterm.js in WebView | Known issue (xterm.js #5108). Mitigation: use `hardwareAcceleratedAndroid` or test with latest WebView. Fallback: keep TextInput as fallback mode. |
| WebView adds significant app size | xterm.js is ~200KB minified. Acceptable for a terminal feature. |
| WebView may not have access to the same WebSocket URL | Use `ws://` or `wss://` with proper CORS configuration. The WebView loads from the same origin as the app. |
| Performance on low-end devices | xterm.js is performant. Use `webViewHardwareAccelerationEnabled` on Android. |
| Expo Go compatibility | `react-native-webview` works in Expo Go. No need for dev client. |

## Preserved Components

- `TerminalSocket` WebSocket connection logic
- `usePtySession` hook
- `PtyWebSocket` class
- `LocalTerminalView` (unchanged)
- `TerminalView` main component (only the server mode rendering changes)
- `useSettings` for terminalFontSize
- `useDensity` for density scaling
- `with-cleartext-traffic.js` plugin
- ANSI output pipeline (no longer needed for server terminal, but preserved for local mode)
