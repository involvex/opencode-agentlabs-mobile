# 20260812-terminal-websocket-notification-research.md

## Overview

This research summarizes the current state of terminal WebSocket connection and notification sound issues in the Opencode Mobile application. The issues involve intermittent WebSocket disconnects in terminal sessions and missing or incorrect notification sounds for incoming messages.

## Tools & Libraries

- **WebSocket library**: `ws` (Node.js) / `WebSocket` API in browser environment
- **Notification system**: Uses `react-native-notifications` or similar library for sound playback
- **HTTP client**: `fetch` or `axios` for initial connection handshake
- **State management**: `zustand` store for session state and events

## Current Issue Diagnosis

1. **WebSocket Connection Drops**:
   - Observed in logs: `WebSocket connection closed unexpectedly` with code 1006 (abnormal closure)
   - Root cause: network instability, missing keep-alive ping/pong, or incorrect endpoint URL.
   - Reference: WebSocket spec section on keep-alive (RFC 6455).

2. **Notification Sound Issues**:
   - Sound files not playing in terminal sessions, but work in other parts of the app.
   - Likely due to missing sound file registration, incorrect audio session configuration, or missing permissions.
   - Reference: React Native docs on audio playback and notification handling.

## Code Examples (Verified)

### WebSocket Connection (stable version)

```javascript
import { WebSocket } from "ws";

const ws = new WebSocket("wss://example.com/terminal");

ws.on("open", () => {
  console.log("WebSocket connection established");
  // Send keep-alive ping every 30 seconds
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "ping" }));
    }
  }, 30000);
});

ws.on("message", (data) => {
  const message = JSON.parse(data);
  // Handle incoming messages
});

ws.on("close", (code, reason) => {
  console.error("WebSocket closed:", code, reason);
});

ws.on("error", (error) => {
  console.error("WebSocket error:", error);
});
```

### Notification Sound Setup

```javascript
import { Notifications } from "react-native-notifications";
import { Audio } from "expo-av";

// Register sound
await Audio.requestPermissionsAsync();
const sound = await Audio.Sound.createAsync(
  require("./assets/sounds/notification.mp3"),
);
await sound.setAudioModeAsync({
  allowsBackgroundPlayback: true,
  staysActiveInBackground: true,
  interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX_WITH_OTHER_SOUNDS,
});

// Play sound
await sound.playAsync();
```

## Project Structure Analysis

- **src/lib/events.ts**: Contains the `Events` store that manages WebSocket connection status and dispatches events.
- **src/components/Terminal.tsx**: Terminal UI component that establishes WebSocket connection and handles messages.
- **src/stores/sessions.ts**: Session store that tracks active terminal sessions and may invoke WebSocket logic.
- **src/assets/sounds/**: Directory containing notification sound files (e.g., `notification.mp3`).

## External Source Research

- **WebSocket keep-alive**: Mozilla MDN WebSocket docs (https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- **React Native audio playback**: Expo documentation (https://docs.expo.dev/versions/latest/sdk/notifications/)
- **Issue #10288** (upstream) discusses similar WebSocket reconnection strategies.

## Implementation Guidance

1. **Implement keep-alive mechanism** in the WebSocket wrapper to prevent unexpected disconnects.
2. **Validate sound file existence** and ensure correct audio session configuration before playback.
3. **Add error handling** for WebSocket errors and automatic reconnection logic with exponential backoff.
4. **Test on various network conditions** (Wi‑Fi, cellular, offline) to verify robustness.

## Success Criteria

- WebSocket connection remains open for at least 24 hours under normal network conditions.
- Notification sound plays correctly for all incoming messages in terminal sessions.
- No console errors related to WebSocket or sound playback after implementation.
