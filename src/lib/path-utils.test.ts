import { test } from "node:test";
import assert from "node:assert/strict";
import { stripTrailingSlash, parentOf, nameOf } from "./path-utils.ts";

// stripTrailingSlash -------------------------------------------------------

test("stripTrailingSlash: removes single and repeated trailing separators", () => {
  assert.equal(stripTrailingSlash("/a/b/"), "/a/b");
  assert.equal(stripTrailingSlash("/a/b///"), "/a/b");
  assert.equal(stripTrailingSlash("C:\\proj\\"), "C:\\proj");
});

test("stripTrailingSlash: keeps input when stripping would empty it", () => {
  assert.equal(stripTrailingSlash("/"), "/");
  assert.equal(stripTrailingSlash("\\"), "\\");
  assert.equal(stripTrailingSlash("///"), "///");
});

test("stripTrailingSlash: leaves paths without trailing separator unchanged", () => {
  assert.equal(stripTrailingSlash("/a/b"), "/a/b");
  assert.equal(stripTrailingSlash("D:/work"), "D:/work");
});

// parentOf -----------------------------------------------------------------

test("parentOf: POSIX root has no parent", () => {
  assert.equal(parentOf("/"), null);
  assert.equal(parentOf("//"), null);
});

test("parentOf: bare backslash has no parent", () => {
  assert.equal(parentOf("\\"), null);
});

test("parentOf: Windows drive roots have no parent", () => {
  assert.equal(parentOf("C:\\"), null);
  assert.equal(parentOf("D:/"), null);
  assert.equal(parentOf("c:"), null);
});

test("parentOf: first-level POSIX dir returns the root", () => {
  assert.equal(parentOf("/home"), "/");
  assert.equal(parentOf("/home/"), "/");
});

test("parentOf: nested POSIX paths walk up one level", () => {
  assert.equal(parentOf("/home/user/project"), "/home/user");
  assert.equal(parentOf("/home/user/project/"), "/home/user");
});

test("parentOf: first-level Windows dir returns the drive root", () => {
  assert.equal(parentOf("C:\\projects"), "C:\\");
  assert.equal(parentOf("D:/work"), "D:\\");
});

test("parentOf: nested Windows backslash paths walk up one level", () => {
  assert.equal(parentOf("C:\\projects\\app"), "C:\\projects");
  assert.equal(parentOf("C:\\projects\\app\\"), "C:\\projects");
});

test("parentOf: mixed-separator Windows paths walk up one level", () => {
  assert.equal(parentOf("D:/work/repo"), "D:/work");
});

test("parentOf: relative segment without separators has no parent", () => {
  assert.equal(parentOf("project"), null);
});

// nameOf ---------------------------------------------------------------------

test("nameOf: returns the last POSIX segment", () => {
  assert.equal(nameOf("/home/user/project"), "project");
  assert.equal(nameOf("/home/user/project/"), "project");
});

test("nameOf: returns the last Windows segment", () => {
  assert.equal(nameOf("C:\\projects\\app"), "app");
  assert.equal(nameOf("D:/work/repo"), "repo");
});

test("nameOf: root paths fall back to the trimmed input", () => {
  assert.equal(nameOf("/"), "/");
  assert.equal(nameOf("C:\\"), "C:");
});

test("nameOf: bare segment is returned as-is", () => {
  assert.equal(nameOf("project"), "project");
});
