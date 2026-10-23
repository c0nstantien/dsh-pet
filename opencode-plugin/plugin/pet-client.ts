import type { PetState } from "./status-machine.ts"

export interface PetClientOptions {
  baseUrl: string
  token: string
  petId?: string
  fetchImpl?: typeof fetch
  log?: (message: string) => void
  cooldownMs?: number
}

export interface PetClient {
  setWorkStatus(state: PetState, task?: string): Promise<boolean>
  clearWorkStatus(): Promise<boolean>
}

const TOKEN_MSG = "[dsh-pet] token 已失效（dsh-pet 可能重启过），请从 Mac 的 ~/.dsh/dsh-pet/standalone-runtime.json 重新复制"
const NET_MSG = "[dsh-pet] 无法连接（隧道或 dsh-pet 未运行？），状态推送暂停"

export function createPetClient(options: PetClientOptions): PetClient {
  const fetchImpl = options.fetchImpl ?? fetch
  const log = options.log ?? (() => {})
  const cooldownMs = options.cooldownMs ?? 60_000
  const petId = options.petId ?? "main"
  let lastWarn = 0

  const warnOnce = (message: string): void => {
    const now = Date.now()
    if (now - lastWarn < cooldownMs) return
    lastWarn = now
    log(message)
  }

  const qs = (extra: Record<string, string> = {}): string =>
    new URLSearchParams({ pet: petId, ...extra }).toString()

  const call = async (path: string, init: RequestInit, warnNet = true): Promise<boolean> => {
    try {
      const res = await fetchImpl(`${options.baseUrl}${path}`, {
        ...init,
        headers: { "x-dsh-pet-token": options.token, ...(init.headers ?? {}) },
      })
      if (res.status === 403) {
        warnOnce(TOKEN_MSG)
        return false
      }
      if (!res.ok) {
        warnOnce(`[dsh-pet] 请求失败 HTTP ${res.status} ${path}`)
        return false
      }
      return true
    } catch {
      if (warnNet) warnOnce(NET_MSG)
      return false
    }
  }

  const json = { "content-type": "application/json" }

  return {
    setWorkStatus(state, task) {
      return call("/work-status?" + qs(), {
        method: "POST",
        headers: json,
        body: JSON.stringify({ state, ...(task ? { task } : {}) }),
      })
    },
    clearWorkStatus() {
      return call("/work-status?" + qs(), { method: "DELETE" })
    },
  }
}
