import { Plugin } from "@opencode/plugin"
import { appendFileSync } from "node:fs"

const LOG = "/tmp/opencode/pet-probe-events.log"

function record(line: string): void {
  try { appendFileSync(LOG, line + "\n") } catch { /* 日志失败不影响宿主 */ }
}

export default Plugin.define({
  id: "dsh-pet-probe",
  async setup(ctx) {
    record(`=== probe loaded, opencode ${ctx.app?.version ?? "unknown"} ===`)
    const controller = new AbortController()
    void (async () => {
      try {
        for await (const event of ctx.event.subscribe({ signal: controller.signal })) {
          record(`EVENT ${event.type} ${JSON.stringify(event).slice(0, 240)}`)
        }
      } catch (error) {
        record(`EVENT stream closed: ${error}`)
      }
    })()
    await ctx.tool.hook("execute.before", (event) => {
      record(`TOOL.BEFORE keys=${Object.keys(event).join(",")} ${JSON.stringify(event).slice(0, 240)}`)
    })
    await ctx.tool.hook("execute.after", (event) => {
      record(`TOOL.AFTER keys=${Object.keys(event).join(",")} ${JSON.stringify(event).slice(0, 240)}`)
    })
    await ctx.permission.hook("evaluate", (event) => {
      record(`PERMISSION keys=${Object.keys(event).join(",")} effect=${event.effect}`)
    })
    await ctx.session.hook("prompt", (event) => {
      record(`PROMPT keys=${Object.keys(event).join(",")} sessionID=${event.sessionID}`)
    })
    return () => controller.abort()
  },
})
