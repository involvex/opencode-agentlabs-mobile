# Plan: Fix Terminal WebSocket Connection (404 Error)

## Problem
The terminal WebSocket connection fails with 404 error because the server's WebSocket endpoint changed from `/ws` to `/connect`, but the client code still uses `/ws`.

**Error from logs:**
```
LOG  [PtyWS] connect {"url": "ws://involvex.myfritz.link:5000/pty/pty_ff207ca2c001TKTZTZ4vsfEjdB/connect?..."}
ERROR  [PtyWS] error ... "Expected HTTP 101 response but was '404 Not Found'"
```

The URL in the log has `/connect` but `buildPtyWsUrl` constructs `/ws`.

## Root Cause
The user deleted and reinstalled the opencode server. The new server version changed the WebSocket endpoint path from `/pty/{ptyId}/ws` to `/pty/{ptyId}/connect`.

## Fix
Update `src/lib/pty-ws.ts` line 34 in the `buildPtyWsUrl` function:

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

## Files to Modify
- `src/lib/pty-ws.ts` - Single line change in `buildPtyWsUrl` function

## Verification
After the fix:
1. Rebuild the app
2. Connect to the opencode server
3. Open a terminal session
4. Verify WebSocket connects successfully (no 404 error)
5. Verify terminal input/output works