// idle/error 事件名与 sessionID 路径已由 Task 1 探针确认（probe/README.md），修正只改这里。
// interrupted / permission 来自 @opencode/schema 的 event-manifest（未总线实测，不符则对应分支静默失效）。
export const EV = {
  idle: "session.execution.succeeded",
  error: "session.execution.failed",
  interrupted: "session.execution.interrupted",
  permission: "session.permissions",
} as const

export function sessionIDOf(event: unknown): string {
  const data = (event as { data?: { sessionID?: unknown } }).data
  return typeof data?.sessionID === "string" ? data.sessionID : ""
}

// session.permissions 载荷：permissions[].effect ∈ allow/deny/ask；存在 ask = 该会话在等批复
export function hasAskEffect(event: unknown): boolean {
  const perms = (event as { data?: { permissions?: unknown } } | null)?.data?.permissions
  return Array.isArray(perms) && perms.some((p) => (p as { effect?: unknown })?.effect === "ask")
}
