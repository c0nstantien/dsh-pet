import assert from "node:assert/strict"
import { test } from "node:test"
import { StatusMachine } from "./status-machine.ts"

const ev = (kind: Parameters<StatusMachine["onEvent"]>[0]["kind"], sessionID = "s1") => ({ kind, sessionID })

test("prompt → thinking 且 changed", () => {
  const m = new StatusMachine()
  const r = m.onEvent(ev("prompt"))
  assert.equal(r.state, "thinking")
  assert.equal(r.changed, true)
})

test("同档位重复事件 changed=false", () => {
  const m = new StatusMachine()
  m.onEvent(ev("prompt"))
  m.onEvent(ev("toolStart"))
  const r = m.onEvent(ev("toolStart"))
  assert.equal(r.state, "working")
  assert.equal(r.changed, false)
})

test("工具开始 working，全部结束回 thinking", () => {
  const m = new StatusMachine()
  m.onEvent(ev("prompt"))
  assert.equal(m.onEvent(ev("toolStart")).state, "working")
  const r = m.onEvent(ev("toolEnd"))
  assert.equal(r.state, "thinking")
  assert.equal(r.changed, true)
})

test("权限 ask → waiting，resolve 后回到 working（工具仍活跃）", () => {
  const m = new StatusMachine()
  m.onEvent(ev("prompt"))
  m.onEvent(ev("toolStart"))
  assert.equal(m.onEvent(ev("permissionAsk")).state, "waiting")
  assert.equal(m.onEvent(ev("permissionResolve")).state, "working")
})

test("并发聚合：A working + B waiting → 全局 waiting；B resolve → working", () => {
  const m = new StatusMachine()
  m.onEvent(ev("prompt", "a"))
  m.onEvent(ev("toolStart", "a"))
  m.onEvent(ev("prompt", "b"))
  assert.equal(m.onEvent(ev("permissionAsk", "b")).state, "waiting")
  assert.equal(m.onEvent(ev("permissionResolve", "b")).state, "working")
})

test("唯一会话 idle → success；clearIfIdle() = true", () => {
  const m = new StatusMachine()
  m.onEvent(ev("prompt"))
  m.onEvent(ev("toolStart"))
  assert.equal(m.onEvent(ev("idle")).state, "success")
  assert.equal(m.clearIfIdle(), true)
  assert.equal(m.active(), null)
})

test("idle 时其他会话仍活跃 → 按剩余会话聚合，clearIfIdle() = false", () => {
  const m = new StatusMachine()
  m.onEvent(ev("prompt", "a"))
  m.onEvent(ev("toolStart", "a"))
  m.onEvent(ev("prompt", "b"))
  assert.equal(m.onEvent(ev("idle", "b")).state, "working")
  assert.equal(m.clearIfIdle(), false)
})

test("error → 全局 error；无会话时 clearIfIdle() = true（settle 后由装配层触发）", () => {
  const m = new StatusMachine()
  m.onEvent(ev("prompt"))
  m.onEvent(ev("toolStart"))
  const r = m.onEvent(ev("error"))
  assert.equal(r.state, "error")
  assert.equal(m.sessions.size, 0)
  assert.equal(m.clearIfIdle(), true)
})

test("新 prompt 解除 error 档 → thinking", () => {
  const m = new StatusMachine()
  m.onEvent(ev("prompt"))
  m.onEvent(ev("error"))
  const r = m.onEvent(ev("prompt", "s2"))
  assert.equal(r.state, "thinking")
  assert.equal(r.changed, true)
})

test("permissionResolve 对未知会话是 no-op（session.permissions 可能先于本插件见到该会话）", () => {
  const m = new StatusMachine()
  const r = m.onEvent(ev("permissionResolve", "ghost"))
  assert.equal(m.sessions.size, 0)
  assert.equal(r.changed, false)
})
