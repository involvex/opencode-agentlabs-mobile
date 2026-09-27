import test from "node:test";
import assert from "node:assert/strict";
import { buildDuplicate } from "./duplicate-connection.ts";
import type { ServerConnection } from "./types.ts";

const source: ServerConnection = {
  id: "abc123",
  name: "Dev Server",
  type: "tunnel",
  url: "http://192.168.1.50:4096",
  username: "admin",
  directory: "/home/user/projects/app",
  lastConnected: 1_700_000_000_000,
  active: true,
  authHeaderKeys: ["X-Api-Key"],
};

test("buildDuplicate: replaces id and name", () => {
  const copy = buildDuplicate(source, "newid456", "Dev Server (copy)");
  assert.equal(copy.id, "newid456");
  assert.equal(copy.name, "Dev Server (copy)");
});

test("buildDuplicate: copy is never active and never lastConnected", () => {
  const copy = buildDuplicate(source, "newid456", "Copy");
  assert.equal(copy.active, false);
  assert.equal(copy.lastConnected, undefined);
});

test("buildDuplicate: preserves connection target and auth fields", () => {
  const copy = buildDuplicate(source, "newid456", "Copy");
  assert.equal(copy.url, source.url);
  assert.equal(copy.directory, source.directory);
  assert.equal(copy.username, source.username);
  assert.equal(copy.type, source.type);
  assert.deepEqual(copy.authHeaderKeys, source.authHeaderKeys);
});

test("buildDuplicate: does not mutate the source record", () => {
  const before = { ...source };
  buildDuplicate(source, "newid456", "Copy");
  assert.deepEqual(source, before);
});
