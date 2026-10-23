import assert from "node:assert/strict"
import { test } from "node:test"
import { createPetClient } from "./pet-client.ts"

const TOKEN = "A".repeat(43)
const BASE = "http://127.0.0.1:3080/dsh-pet-7340"

function recorder(responder: (url: string, init: RequestInit) => Response) {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const logs: string[] = []
  const fetchImpl = (async (url: unknown, init?: RequestInit) => {
    const entry = { url: String(url), init: init ?? {} }
    calls.push(entry)
    return responder(entry.url, entry.init)
  }) as typeof fetch
  return { calls, logs, fetchImpl }
}

test("setWorkStatus 发对方法/路径/头/body", async () => {
  const r = recorder(() => new Response("{}", { status: 200 }))
  const client = createPetClient({ baseUrl: BASE, token: TOKEN, fetchImpl: r.fetchImpl, log: (m) => r.logs.push(m) })
  assert.equal(await client.setWorkStatus("working", "改配置"), true)
  assert.equal(r.calls[0].url, `${BASE}/work-status?pet=main`)
  assert.equal(r.calls[0].init.method, "POST")
  assert.equal((r.calls[0].init.headers as Record<string, string>)["x-dsh-pet-token"], TOKEN)
  assert.deepEqual(JSON.parse(String(r.calls[0].init.body)), { state: "working", task: "改配置" })
})

test("clearWorkStatus 用 DELETE", async () => {
  const r = recorder(() => new Response(null, { status: 204 }))
  const client = createPetClient({ baseUrl: BASE, token: TOKEN, fetchImpl: r.fetchImpl })
  assert.equal(await client.clearWorkStatus(), true)
  assert.equal(r.calls[0].init.method, "DELETE")
})

test("连续 403 只限频告警一次且返回 false", async () => {
  const r = recorder(() => new Response("{}", { status: 403 }))
  const client = createPetClient({ baseUrl: BASE, token: TOKEN, fetchImpl: r.fetchImpl, log: (m) => r.logs.push(m), cooldownMs: 60_000 })
  for (let i = 0; i < 5; i += 1) assert.equal(await client.setWorkStatus("thinking"), false)
  assert.equal(r.logs.length, 1)
  assert.match(r.logs[0], /token/)
})

test("fetch reject（隧道不通）返回 false 且限频告警", async () => {
  const logs: string[] = []
  const fetchImpl = (async () => { throw new Error("ECONNREFUSED") }) as typeof fetch
  const client = createPetClient({ baseUrl: BASE, token: TOKEN, fetchImpl, log: (m) => logs.push(m), cooldownMs: 60_000 })
  assert.equal(await client.setWorkStatus("thinking"), false)
  assert.equal(await client.setWorkStatus("thinking"), false)
  assert.equal(logs.length, 1)
  assert.match(logs[0], /无法连接/)
})
