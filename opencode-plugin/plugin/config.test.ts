import assert from "node:assert/strict"
import { test } from "node:test"
import { resolveConfig } from "./config.ts"

test("默认值：baseUrl 钉 127.0.0.1:3080，token 取 env，空 token 允许（由入口停用）", () => {
  const c = resolveConfig(undefined, {})
  assert.equal(c.baseUrl, "http://127.0.0.1:3080/dsh-pet-7340")
  assert.equal(c.token, "")
  assert.equal(c.petId, "main")
  assert.equal(c.settleDelayMs, 60_000)
})

test("options 覆盖 env，env 覆盖默认；非法 options 不炸", () => {
  const c = resolveConfig({ baseUrl: "http://127.0.0.1:3999/dsh-pet-7340" }, { DSH_PET_TOKEN: "t" })
  assert.equal(c.baseUrl, "http://127.0.0.1:3999/dsh-pet-7340")
  assert.equal(c.token, "t")
  const d = resolveConfig("garbage", { DSH_PET_TOKEN: "t" })
  assert.equal(d.token, "t")
})
