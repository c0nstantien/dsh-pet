// 全局档位 = 活跃会话中优先级最高者；空闲聚合为 success。
// P1 永不产出 result（dsh-pet 契约保留该档位，仅本插件不用）。
export type PetState = "thinking" | "working" | "result" | "waiting" | "success" | "error"

export interface MachineEvent {
  kind: "prompt" | "toolStart" | "toolEnd" | "permissionAsk" | "permissionResolve" | "idle" | "error"
  sessionID: string
}

export interface MachineResult {
  state: PetState
  changed: boolean
}

const PRIORITY: Partial<Record<PetState, number>> = { waiting: 4, error: 3, working: 2, thinking: 1 }

interface SessionState {
  tools: number
  pendingPermission: boolean
}

export class StatusMachine {
  // 暴露只读访问供测试断言（生产代码不得依赖）
  readonly sessions = new Map<string, SessionState>()
  private current: PetState | null = null

  private aggregate(): PetState {
    let state: PetState = "success"
    let best = 0
    for (const s of this.sessions.values()) {
      const st: PetState = s.pendingPermission ? "waiting" : s.tools > 0 ? "working" : "thinking"
      const rank = PRIORITY[st] ?? 0
      if (rank > best) {
        best = rank
        state = st
      }
    }
    return state
  }

  onEvent(event: MachineEvent): MachineResult {
    const s = this.sessions.get(event.sessionID) ?? { tools: 0, pendingPermission: false }
    switch (event.kind) {
      case "prompt":
        this.sessions.set(event.sessionID, { tools: 0, pendingPermission: false })
        break
      case "toolStart":
        s.tools += 1
        this.sessions.set(event.sessionID, s)
        break
      case "toolEnd":
        s.tools = Math.max(0, s.tools - 1)
        this.sessions.set(event.sessionID, s)
        break
      case "permissionAsk":
        s.pendingPermission = true
        this.sessions.set(event.sessionID, s)
        break
      case "permissionResolve":
        // session.permissions 可能先于本插件见到该会话：未知会话的批复完全不产生状态迁移
        // （否则冷启动首个事件就会从 null 迁到 success，装配层误当收尾播报）
        if (!this.sessions.has(event.sessionID)) return { state: this.current ?? "success", changed: false }
        s.pendingPermission = false
        this.sessions.set(event.sessionID, s)
        break
      case "idle":
      case "error":
        this.sessions.delete(event.sessionID)
        break
    }
    const next: PetState = event.kind === "error" ? "error" : this.aggregate()
    const changed = next !== this.current
    this.current = next
    return { state: next, changed }
  }

  active(): PetState | null {
    return this.current
  }

  // 仅在无活跃会话且处于收尾档（success/error）时清空回空闲
  clearIfIdle(): boolean {
    if (this.sessions.size === 0 && (this.current === "success" || this.current === "error")) {
      this.current = null
      return true
    }
    return false
  }
}
