export interface PetPluginOptions {
  baseUrl?: string
  token?: string
  petId?: string
  settleDelayMs?: number
}

export interface PetConfig {
  baseUrl: string
  token: string
  petId: string
  settleDelayMs: number
}

export function resolveConfig(raw: unknown, env: Record<string, string | undefined>): PetConfig {
  const o = (typeof raw === "object" && raw !== null ? raw : {}) as Partial<PetPluginOptions>
  return {
    baseUrl: o.baseUrl ?? "http://127.0.0.1:3080/dsh-pet-7340",
    token: o.token ?? env.DSH_PET_TOKEN ?? "",
    petId: o.petId ?? "main",
    settleDelayMs: o.settleDelayMs ?? 60_000,
  }
}
