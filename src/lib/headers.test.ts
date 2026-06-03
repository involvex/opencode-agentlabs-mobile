import { test } from "node:test"
import assert from "node:assert/strict"
import { buildRequestHeaders } from "./headers.ts"

// These headers authenticate every request and tell the server which project
// directory to operate in. A bug here breaks connections or silently targets the
// wrong directory, so the auth + encoding rules are pinned.

test("always sets JSON content type", () => {
  assert.equal(buildRequestHeaders({})["Content-Type"], "application/json")
})

test("omits directory and auth headers when not provided", () => {
  const h = buildRequestHeaders({})
  assert.equal("x-opencode-directory" in h, false)
  assert.equal("Authorization" in h, false)
})

test("passes ASCII directory through unencoded (server gets a readable path)", () => {
  const h = buildRequestHeaders({ directory: "/home/user/projects/app" })
  assert.equal(h["x-opencode-directory"], "/home/user/projects/app")
})

test("percent-encodes a directory containing non-ASCII characters", () => {
  const dir = "/home/usér/projç"
  const h = buildRequestHeaders({ directory: dir })
  assert.equal(h["x-opencode-directory"], encodeURIComponent(dir))
  // Result must be header-safe (latin1 / ASCII only).
  assert.match(h["x-opencode-directory"], /^[\x00-\x7F]*$/)
})

test("encodes CJK directory names header-safely", () => {
  const dir = "/projects/プロジェクト"
  const h = buildRequestHeaders({ directory: dir })
  assert.match(h["x-opencode-directory"], /^[\x00-\x7F]*$/)
  assert.equal(decodeURIComponent(h["x-opencode-directory"]), dir)
})

test("builds a Basic auth header from username and password", () => {
  const h = buildRequestHeaders({ auth: { username: "alice", password: "s3cret" } })
  assert.equal(h["Authorization"], `Basic ${btoa("alice:s3cret")}`)
  // Round-trips back to the credentials.
  assert.equal(atob(h["Authorization"].replace("Basic ", "")), "alice:s3cret")
})

test("sets both directory and auth headers together", () => {
  const h = buildRequestHeaders({
    directory: "/srv/app",
    auth: { username: "u", password: "p" },
  })
  assert.equal(h["x-opencode-directory"], "/srv/app")
  assert.equal(h["Authorization"], `Basic ${btoa("u:p")}`)
  assert.equal(h["Content-Type"], "application/json")
})

test("empty-string directory is treated as absent (falsy)", () => {
  const h = buildRequestHeaders({ directory: "" })
  assert.equal("x-opencode-directory" in h, false)
})
