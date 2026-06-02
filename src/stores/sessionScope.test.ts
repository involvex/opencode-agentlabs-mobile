import { test } from "node:test"
import assert from "node:assert/strict"
import { sessionScopeDirectory } from "./sessionScope.ts"

// Bug #10 regression guard: list and create must resolve to the SAME scope.
// These cases pin the shared rule both call sites rely on.

test("no explicit directory + known home -> scope to home", () => {
  assert.equal(sessionScopeDirectory(false, "/home/user"), "/home/user")
})

test("no explicit directory + unknown home -> default client (null)", () => {
  assert.equal(sessionScopeDirectory(false, null), null)
  assert.equal(sessionScopeDirectory(false, undefined), null)
  assert.equal(sessionScopeDirectory(false, ""), null)
})

test("explicit directory -> default client (null), home ignored", () => {
  assert.equal(sessionScopeDirectory(true, "/home/user"), null)
  assert.equal(sessionScopeDirectory(true, null), null)
})

test("create and list resolve identically across all inputs (no drift)", () => {
  for (const hasDir of [true, false]) {
    for (const home of ["/home/user", null, undefined, ""]) {
      const listScope = sessionScopeDirectory(hasDir, home)
      const createScope = sessionScopeDirectory(hasDir, home)
      assert.equal(listScope, createScope)
    }
  }
})
