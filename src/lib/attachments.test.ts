import { test } from "node:test";
import assert from "node:assert/strict";
import {
  guessMimeFromFilename,
  arrayBufferToBase64,
  formatFileSize,
  isImageAttachment,
} from "./attachments.ts";

test("guessMimeFromFilename: maps common extensions", () => {
  assert.equal(guessMimeFromFilename("notes.txt"), "text/plain");
  assert.equal(guessMimeFromFilename("doc.PDF"), "application/pdf");
  assert.equal(guessMimeFromFilename("code.ts"), "text/typescript");
  assert.equal(guessMimeFromFilename("photo.jpg"), "image/jpeg");
});

test("guessMimeFromFilename: falls back for unknown/missing names", () => {
  assert.equal(
    guessMimeFromFilename("archive.unknownext"),
    "application/octet-stream",
  );
  assert.equal(guessMimeFromFilename(undefined), "application/octet-stream");
  assert.equal(guessMimeFromFilename("noext", "text/plain"), "text/plain");
});

test("arrayBufferToBase64: round-trips bytes", () => {
  const bytes = new Uint8Array([72, 105, 33]);
  const encoded = arrayBufferToBase64(bytes.buffer as ArrayBuffer);
  assert.equal(encoded, "SGkh");
});

test("formatFileSize: formats B/KB/MB", () => {
  assert.equal(formatFileSize(undefined), "");
  assert.equal(formatFileSize(512), "512 B");
  assert.equal(formatFileSize(2048), "2.0 KB");
  assert.equal(formatFileSize(5 * 1024 * 1024), "5.0 MB");
});

test("isImageAttachment: detects image mime only", () => {
  assert.equal(isImageAttachment({ uri: "a", mime: "image/png" }), true);
  assert.equal(isImageAttachment({ uri: "a", mime: "application/pdf" }), false);
});
