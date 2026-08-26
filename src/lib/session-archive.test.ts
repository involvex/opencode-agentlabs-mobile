import { test } from "node:test";
import assert from "node:assert/strict";
import { partitionArchived } from "./session-archive.ts";

function session(id: string) {
  return {
    id,
    title: `Session ${id}`,
    directory: "/a",
    time: { created: 1, updated: 1 },
  } as unknown as Parameters<typeof partitionArchived>[0][number];
}

test("partitionArchived: splits active and archived, preserving order", () => {
  const { active, archived } = partitionArchived(
    [session("1"), session("2"), session("3")],
    ["2"],
  );
  assert.deepEqual(
    active.map((s) => s.id),
    ["1", "3"],
  );
  assert.deepEqual(
    archived.map((s) => s.id),
    ["2"],
  );
});

test("partitionArchived: empty archive list keeps everything active", () => {
  const { active, archived } = partitionArchived(
    [session("1"), session("2")],
    [],
  );
  assert.equal(active.length, 2);
  assert.equal(archived.length, 0);
});

test("partitionArchived: ignores archive IDs without matching sessions", () => {
  const { active, archived } = partitionArchived([session("1")], ["gone", "1"]);
  assert.deepEqual(
    active.map((s) => s.id),
    [],
  );
  assert.deepEqual(
    archived.map((s) => s.id),
    ["1"],
  );
});

test("partitionArchived: tolerates non-array input", () => {
  const { active, archived } = partitionArchived(
    undefined as unknown as Parameters<typeof partitionArchived>[0],
    [],
  );
  assert.deepEqual(active, []);
  assert.deepEqual(archived, []);
});
