# Implementation Plan: Fix Terminal WebSocket Connection and Notification Sound Issues

## Summary

This plan addresses two critical issues affecting the OpenCode mobile application:

1. **Terminal WebSocket Connection Failure** - Terminal sessions cannot establish WebSocket connections due to endpoint mismatch
2. **Notification Sound Configuration** - Expo notifications cannot play sounds because 'default' sound file is missing from configuration

## Current State Analysis

### WebSocket Issue

- **Error**: 404 Not Found when connecting to `/pty/{ptyId}/connect`
- **Current URL Construction**: `/pty/{ptyId}/ws` (incorrect)
- **Server Expectation**: `/pty/{ptyId}/connect` (based on error logs)
- **Status**: Connection attempts timeout after 10 seconds

### 2. Notification Sound Issue

- **Error**: "Custom sound 'default' not found in native app"
- **Current Configuration**: Only `ping.wav` is included in sounds array
- **Required Fix**: Add `default.wav` to sounds array and rebuild

## Implementation Plan

### Step 1: WebSocket Endpoint Fix

#### 1.1 Server Endpoint Analysis

- Server endpoint changed from `/ws` to `/connect` (based on error logs)
- Client code must match server endpoint format

#### 1.2 Fix Implementation

**File:** `src/lib/pty-ws.ts`  
**Line:** 34  
**Change:** Update URL construction to use `/connect` instead of `/ws`

**Before:**

```ts
const httpUrl = new URL(
  `/pty/${opts.ptyId}/ws`,
  opts.baseUrl.endsWith("/") ? opts.baseUrl : `${opts.baseUrl}/`,
);
```

**After:**

```ts
const httpUrl = new URL(
  `/pty/${opts.ptyId}/connect`,
  opts.baseUrl.endsWith("/") ? opts.baseUrl : `${opts.baseUrl}/`,
);
```

### Step 2: Notification Sound Configuration

#### 2.1 Sound File Requirements

- Must have `default.wav` file in `assets/sounds/` directory
- File must be valid WAV format (any duration acceptable)

#### 2.3 Configuration Update

**File:** `app.json`  
**Change:** Update `sounds` array to include both sound files:

```json
"sounds": ["./assets/sounds/ping.wav", "./assets/sounds/default.wav"]
```

### 4. Verification Steps

1. **WebSocket Fix Verification:**
   - Confirm build succeeds with `bun run typecheck`
   - Test terminal connection after rebuild
   - Verify no 404 errors in logs

2. **Notification Sound Verification:**
   - Confirm `default.wav` exists in `assets/sounds/`
   - Verify `app.json` contains correct sound references
   - Rebuild and test with actual notification

## Execution Requirements

1. **WebSocket Fix:**
   - Modify `src/lib/pty-ws.ts` line 34
   - Ensure no other code paths are affected
   - Test with existing session

2. **Sound Configuration:**
   - Add `default.wav` to `assets/sounds/` directory
   - Update `app.json` sounds array
   - Run `bun run expo:prebuild` and `bun run android`

## Success Criteria

- ✅ WebSocket connection establishes without 404 errors
- ✅ Terminal sessions load and function normally
- ✅ App plays notification sounds when events occur
- ✅ No regression in existing functionality

## User Instructions

1. **Implement WebSocket Fix:**
   - Open `src/lib/pty-ws.ts`
   - Modify line 34 to use `/pty/{ptyId}/connect` instead of `/pty/{ptyId}/ws`
   - Save file and verify no syntax errors

2. **Fix Notification Sound:**
   - Create or obtain `default.wav` file
   - Add to `assets/sounds/` directory
   - Update `app.json` to include `default.wav` in sounds array
   - Run `bun run expo:prebuild` and `bun run android`

3. **Test and Verify:**
   - Open new session in app
   - Verify terminal loads and displays messages
   - Ask app to write hello_world.py and verify completion
   - Check for sound notifications during session activity

The implementation plan is complete and ready for execution. You may proceed with the steps outlined above.
