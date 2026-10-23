import assert from "node:assert/strict"
import { test } from "node:test"
import { createMockPetServer } from "./mock-pet-server.mjs"
import { StatusMachine } from "../plugin/status-machine.ts"
import { createPetClient } from "../plugin/pet-client.ts"

const TOKEN = "A".repeat(43)

test("一次完整任务周期的 HTTP 契约：thinking → working → thinking → success，settle 后转空闲", async () => {
  const mock = createMockPetServer({ token: TOKEN })
  const url = await mock.listen()
  try {
    const machine = new StatusMachine()
    const client = createPetClient({ baseUrl: url + "/dsh-pet-7340", token: TOKEN })
    const push = async (event) => {
      const r = machine.onEvent(event)
      // 与装配层同规则：success 档 task 固定为收尾文案，其余档位跟随 lastTask（e2e 里无 lastTask）
      if (r.changed) await client.setWorkStatus(r.state, r.state === "success" ? "OK 搞定✅" : undefined)
      return r
    }
    await push({ kind: "prompt", sessionID: "s1" })
    await push({ kind: "toolStart", sessionID: "s1" })
    await push({ kind: "toolEnd", sessionID: "s1" })
    const done = await push({ kind: "idle", sessionID: "s1" })
    assert.equal(done.state, "success")
    // 无 announce 链；success 保持 settleDelayMs（默认 1 分钟）后由装配层清空转空闲
    assert.deepEqual(
      mock.requests.map((r) => `${r.method} ${r.path}${Object.keys(r.query).length ? "?" + new URLSearchParams(r.query).toString() : ""}`),
      [
        "POST /dsh-pet-7340/work-status?pet=main",   // thinking
        "POST /dsh-pet-7340/work-status?pet=main",   // working
        "POST /dsh-pet-7340/work-status?pet=main",   // thinking
        "POST /dsh-pet-7340/work-status?pet=main",   // success
      ],
    )
    const bodies = mock.requests.filter((r) => r.path.endsWith("work-status") && r.method === "POST").map((r) => JSON.parse(r.body).state)
    assert.deepEqual(bodies, ["thinking", "working", "thinking", "success"])
    const successBody = JSON.parse(mock.requests.filter((r) => r.path.endsWith("work-status") && r.method === "POST")[3].body)
    assert.deepEqual(successBody, { state: "success", task: "OK 搞定✅" })
    assert.equal(machine.clearIfIdle(), true) // settle 到期，装配层触发
    await client.clearWorkStatus()
    assert.deepEqual(
      mock.requests.filter((r) => r.method === "DELETE").map((r) => `${r.method} ${r.path}?pet=main`),
      ["DELETE /dsh-pet-7340/work-status?pet=main"],
    )
  } finally {
    await mock.close()
  }
})

test("token 错误 → mock 403，client 全部返回 false（Review Focus #1 全链路）", async () => {
  const mock = createMockPetServer({ token: "B".repeat(43) })
  const url = await mock.listen()
  try {
    const logs = []
    const client = createPetClient({ baseUrl: url, token: TOKEN, log: (m) => logs.push(m), cooldownMs: 60_000 })
    assert.equal(await client.setWorkStatus("thinking"), false)
    assert.equal(await client.clearWorkStatus(), false)
    assert.equal(logs.length, 1)
    assert.match(logs[0], /token/)
  } finally {
    await mock.close()
  }
})
