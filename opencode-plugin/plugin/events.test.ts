import assert from "node:assert/strict"
import { test } from "node:test"
import { EV, hasAskEffect } from "./events.ts"

test("EV 事件名与 probe/schema 记录一致", () => {
  assert.equal(EV.idle, "session.execution.succeeded")
  assert.equal(EV.error, "session.execution.failed")
  assert.equal(EV.interrupted, "session.execution.interrupted")
  assert.equal(EV.permission, "session.permissions")
})

test("hasAskEffect：permissions 含 ask → true，allow/deny/空/畸形 → false", () => {
  const wrap = (permissions: unknown) => ({ data: { sessionID: "s1", permissions } })
  assert.equal(hasAskEffect(wrap([{ effect: "ask" }])), true)
  assert.equal(hasAskEffect(wrap([{ effect: "allow" }, { effect: "ask" }])), true)
  assert.equal(hasAskEffect(wrap([{ effect: "allow" }])), false)
  assert.equal(hasAskEffect(wrap([{ effect: "deny" }])), false)
  assert.equal(hasAskEffect(wrap([])), false)
  assert.equal(hasAskEffect(wrap(undefined)), false)
  assert.equal(hasAskEffect({ data: {} }), false)
  assert.equal(hasAskEffect(null), false)
})
