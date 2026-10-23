# 事件名探针记录（Task 1 产出，Task 5 events.ts/index.ts 以此为准）

- 探针版本: opencode 2.1.2；加载方式 = `.opencode/opencode.jsonc` 的 `plugins` 数组（绝对目录路径），**生效**，无需 fallback 到 `.opencode/plugins/`。
- 会话完成事件（P1 的 idle 信号）: type=`session.execution.succeeded`，sessionID 路径=`data.sessionID`
  - 实测完整序列: `prompt(hook) → session.inbox.enqueued → session.execution.started → session.instructions.updated → session.inbox.delivered → session.step.started → session.reasoning.* / session.text.* / session.tool.* → session.step.ended → session.usage.updated → session.execution.succeeded`
- 会话失败事件（P1 的 error 信号）: type=`session.execution.failed`（opencode 二进制 strings 确认存在；总线实测只捕到 succeeded，failed 为对称命名推断。若实际不触发，error 档静默不用——安全降级，无假阳性）
  - 同族还有 `session.execution.interrupted`（用户中断）；`session.error` / `session.idle` 在二进制中存在但事件总线上**未出现**，勿用。
- prompt 钩子载荷 keys: `sessionID,messageID,prompt,metadata,delivery`（sessionID 在顶层；`prompt.text` 内部形状未逐字段确认，index.ts 对 lastTask 做防御性提取）
- tool 钩子载荷含 sessionID: **是**（keys=`tool,sessionID,agent,messageID,id,input`）→ 计划中的 fallback 不需要
- permission 钩子载荷 keys: `sessionID,agent,action,resources,metadata,source,effect`
- 已知边界（影响 Task 5 与联调）:
  - 默认模型解析在本机网络会超时（拉 models.dev 反复重试，实测一次 run 267s 才完成）——`opencode run` 验证必须带 `-m yumchina/openai/yumcode-std`
  - `opencode service restart` 会重启当前 OpenCode 会话所在的 server，会话由 harness 恢复——在会话内执行重启属预期内现象，重启命令放在 shell 调用末尾
  - 长时间卡住的会话最终也会补发 `execution.succeeded`（实测 267s），不会永久悬挂
- 复跑方法: `rm -f /tmp/opencode/pet-probe-events.log && opencode service restart && opencode run -m yumchina/openai/yumcode-std "回复 ok"`
