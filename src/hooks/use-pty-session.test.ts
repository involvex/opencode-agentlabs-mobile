import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatPtyError, isPtyNotFoundError } from "./use-pty-session.ts";

describe("isPtyNotFoundError", () => {
  it("detects PtyNotFoundError payload in API Error message", () => {
    const err = new Error(
      'API Error: 404 - {"_tag":"PtyNotFoundError","ptyID":"pty_abc","message":"PTY session not found: pty_abc"}',
    );
    assert.equal(isPtyNotFoundError(err), true);
  });

  it("rejects unrelated errors", () => {
    assert.equal(isPtyNotFoundError(new Error("API Error: 500 - boom")), false);
    assert.equal(isPtyNotFoundError(null), false);
  });
});

describe("formatPtyError", () => {
  it("rewrites PtyNotFoundError into a short recovery hint", () => {
    const raw =
      'API Error: 404 - {"_tag":"PtyNotFoundError","ptyID":"pty_abc","message":"PTY session not found: pty_abc"}';
    assert.match(formatPtyError(raw), /expired/i);
  });

  it("prefers nested JSON message when present", () => {
    const raw = 'API Error: 400 - {"message":"cwd required"}';
    assert.equal(formatPtyError(raw), "cwd required");
  });
});
