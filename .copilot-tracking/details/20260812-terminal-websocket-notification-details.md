<!-- markdownlint-disable-file -->

# Task Details: Terminal WebSocket Connection and Notification Sound Fix

## Research Reference

**Source Research**: #file:../research/20260812-terminal-websocket-notification-research.md

## Phase 1: WebSocket Connection Stabilization

### Task 1.1: Implement keep-alive and reconnection logic

Add keep-alive ping/pong and automatic reconnection with exponential backoff to the WebSocket wrapper.

- **Files**:
  - src/lib/events.ts - Contains WebSocket wrapper logic and event dispatching.
  - src/components/Terminal.tsx - Uses the WebSocket wrapper and may need modifications to handle reconnection events.
- **Success**:
  - WebSocket connection remains open for at least 24 hours under normal network conditions.
  - Automatic reconnection occurs within 5 seconds after a disconnect.
- **Research References**:
  - #file:../research/20260812-terminal-websocket-notification-research.md (Lines 10-15) - WebSocket keep-alive mechanism description.
  - #githubRepo:"dzianisv/opencode-mobile WebSocket terminal" - Implementation patterns for WebSocket keep-alive and reconnection.
- **Dependencies**:
  - None (foundational task)

### Task 1.2: Add error handling and exponential backoff reconnection

Modify the WebSocket connection logic to handle 'close' events and automatically reconnect with exponential backoff.

- **Files**:
  - src/lib/events.ts - Core WebSocket wrapper that needs reconnection logic.
  - src/components/Terminal.tsx - Listens for reconnection events and updates UI accordingly.
- **Success**:
  - Automatic reconnection completes within 5 seconds after a disconnect.
  - No unhandled WebSocket errors appear in console.
- **Research References**:
  - #file:../research/20260812-terminal-websocket-notification-research.md (Lines 40-50) - Reconnection strategy details.
  - #githubRepo:"dzianisv/opencode-mobile WebSocket" - Example reconnection patterns.
- **Dependencies**:
  - Task 1.1 completion

## Phase 2: Notification Sound Configuration

### Task 2.1: Verify sound file registration and audio session configuration

Validate that the notification sound file exists and that the audio session is configured for background playback without mixing.

- **Files**:
  - src/assets/sounds/notification.mp3 - Sound file asset that must be present and correctly referenced.
  - src/stores/sessions.ts - Audio session configuration that enables background playback and prevents sound mixing.
- **Success**:
  - Sound file loads without errors during app startup.
  - Audio session configured to allow background playback and not mix with other sounds.
- **Research References**:
  - #file:../research/20260812-terminal-websocket-notification-research.md (Lines 55-65) - Sound file registration and audio session setup.
  - #githubRepo:"dzianisv/opencode-mobile notification sound" - Guidelines for audio session configuration.
- **Dependencies**:
  - Task 1.1 completion (ensuring stable connection before sound handling)

### Task 2.2: Trigger sound playback on message receipt

Modify message handling to play the notification sound whenever a new terminal message is received.

- **Files**:
  - src/lib/events.ts - Message processing logic that should trigger sound playback.
  - src/components/Terminal.tsx - UI component that receives messages and may need to handle sound events.
- **Success**:
  - Audible notification plays for each incoming terminal message.
  - No console errors related to sound playback.
- **Research References**:
  - #file:../research/20260812-terminal-websocket-notification-research.md (Lines 70-75) - Notification sound implementation details.
  - #githubRepo:"dzianisv/opencode-mobile notification" - Patterns for playing sound on events.
- **Dependencies**:
  - Task 2.1 completion

## Dependencies

- WebSocket library (ws) - for stable connection handling
- React Native Audio API (expo-av) - for sound playback
- Access to src/assets/sounds/ directory for sound files
- Existing project structure as defined in research file

## Success Criteria

- WebSocket connection remains stable for 24+ hours without abnormal disconnects.
- Notification sound plays correctly for all incoming terminal messages.
- No console errors related to WebSocket or sound playback after implementation.
