import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDiff } from "./parse-diff.ts";

test("parseDiff extracts add/remove/context hunks", () => {
  const hunks = parseDiff(`@@ -1,3 +1,4 @@
 context
-old
+new
+extra
`);
  assert.equal(hunks.length, 1);
  assert.equal(hunks[0].header, "@@ -1,3 +1,4 @@");
  assert.deepEqual(
    hunks[0].lines.map((l) => l.type),
    ["context", "remove", "add", "add"],
  );
});

test("parseDiff returns empty for blank input", () => {
  assert.deepEqual(parseDiff(""), []);
});
