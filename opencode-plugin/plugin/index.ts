import { Plugin } from "@opencode/plugin"
import { resolveConfig } from "./config.ts"
import { StatusMachine } from "./status-machine.ts"
import { createPetClient } from "./pet-client.ts"
import { EV, hasAskEffect, sessionIDOf } from "./events.ts"

export default Plugin.define({
  id: "dsh-pet-bridge",
  async setup(ctx) {
    const config = resolveConfig(ctx.options, process.env)
    if (!config.token) {
      console.warn("[dsh-pet] 未配置 DSH_PET_TOKEN（opencode service set env DSH_PET_TOKEN <token>），桌宠联动停用")
      return
    }
    const machine = new StatusMachine()
    const client = createPetClient({ baseUrl: config.baseUrl, token: config.token, petId: config.petId, log: (m) => console.warn(m) })
    let settleTimer: ReturnType<typeof setTimeout> | undefined
    let lastTask: string | undefined

    const push = (result: { state: string; changed: boolean }) => {
      if (!result.changed) return
      clearTimeout(settleTimer)
      if (result.state === "success" || result.state === "error") {
        // 官方语义 success 保留不自动清（api-tester：「success 保留，需手动清空」）；
        // 这里按 settleDelayMs（默认 1 分钟）转空闲，下次消息提前覆盖
        settleTimer = setTimeout(() => {
          if (machine.clearIfIdle()) void client.clearWorkStatus()
        }, config.settleDelayMs)
      }
      void client.setWorkStatus(result.state, result.state === "success" ? "OK 搞定✅" : lastTask)
    }

    await ctx.session.hook("prompt", (event) => {
      // prompt 载荷形状（prompt.text）以 Task 1 探针记录为准，不符时只改这里
      const raw = (event as { prompt?: { text?: unknown } }).prompt?.text
      if (typeof raw === "string") lastTask = raw.trim().slice(0, 40)
      push(machine.onEvent({ kind: "prompt", sessionID: event.sessionID }))
    })

    await ctx.tool.hook("execute.before", (event) => {
      // 载荷含 sessionID（Task 1 探针已确认）
      push(machine.onEvent({ kind: "toolStart", sessionID: event.sessionID }))
    })

    await ctx.tool.hook("execute.after", (event) => {
      push(machine.onEvent({ kind: "toolEnd", sessionID: event.sessionID }))
    })

    await ctx.permission.hook("evaluate", (event) => {
      if (event.effect !== "ask") return
      push(machine.onEvent({ kind: "permissionAsk", sessionID: event.sessionID }))
      // 不改 effect、不 await 网络：权限评估零延迟
    })

    const controller = new AbortController()
    void (async () => {
      try {
        for await (const event of ctx.event.subscribe({ signal: controller.signal })) {
          if (event.type === EV.idle) {
            push(machine.onEvent({ kind: "idle", sessionID: sessionIDOf(event) }))
          } else if (event.type === EV.error) {
            push(machine.onEvent({ kind: "error", sessionID: sessionIDOf(event) }))
          } else if (event.type === EV.interrupted) {
            const result = machine.onEvent({ kind: "idle", sessionID: sessionIDOf(event) })
            if (result.changed && result.state === "success") {
              // 中断≠完成：不进 success 档、不庆祝，直接清外部槽
              if (machine.clearIfIdle()) void client.clearWorkStatus()
            } else {
              push(result)
            }
          } else if (event.type === EV.permission) {
            // session.permissions 是 permissionResolve 的生产事件源（permission.evaluate 只在决策前触发一次）
            push(machine.onEvent({ kind: hasAskEffect(event) ? "permissionAsk" : "permissionResolve", sessionID: sessionIDOf(event) }))
          }
        }
      } catch {
        // 事件流断开：静默，重连由新 setup 负责
      }
    })()

    return () => {
      controller.abort()
      clearTimeout(settleTimer)
    }
  },
})
