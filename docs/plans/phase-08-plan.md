# Phase 08 Plan: PRD Acceptance Hardening

## Context

Phase 01-07 已覆盖 PRD 的主要产品能力和后续规划：

- DAG 调度 MVP。
- 增强调度策略。
- 可视化投影。
- 任务模板。
- 跨项目调度。
- 执行 CLI 编排。
- 长期记忆接入边界。

继续推进时，优先补齐 PRD 验收标准中偏“系统可靠性”的硬化项，而不是引入新的产品方向。

## Scope

Phase 08 做：

- 补齐 scheduler / CLI 导致的任务状态变化 audit coverage。
- 统一 CLI `TaskGraphSchedulerError` 的 JSON 错误输出能力。
- 强化 MessageBus 与 mailbox 关键消息的可审计性边界。
- 增加 PRD acceptance hardening 测试，覆盖状态审计、错误结构、消息恢复相关行为。

Phase 08 不做：

- 不接真实 OpenClaw sessions_spawn / sessions_send。
- 不引入 UI。
- 不改变 plan schema。
- 不引入新 runtime dependency。
- 不实现分布式锁或多用户权限。

## Tasks

### T049 Scheduler state-change audit coverage

- 扩展 CLI `next-wave`。
- 对 dependency resolver 产生的 task status changes 写入 audit log。
- 覆盖 `pending -> ready`、`pending -> blocked` 等 scheduler-driven 状态变化。
- 保持现有 state 输出兼容。

### T050 CLI structured error JSON mode

- 为 CLI 增加一致的结构化错误输出。
- 至少覆盖 `TaskGraphSchedulerError` 的 `code`、`message`、`details`。
- 保持现有成功输出 JSON 不变。
- 如需改变 stderr 兼容格式，实施前必须停下来确认。

### T051 Message audit and recovery hardening

- 明确 MessageBus / MailboxStore 与 audit log 的边界。
- 覆盖关键消息持久化、ACK、processed、failed 记录的恢复语义。
- 不改变 Agent 消息直接更新任务状态的约束。

### T052 PRD hardening acceptance tests

- 增加端到端验收测试，覆盖 PRD 中“每个任务状态变化都有记录”和“结构化错误”。
- 确认 Phase 01-07 回归测试继续通过。
- 更新 progress README 和 agent.md。

## Verification

```txt
npm run typecheck
npm run build
npm test
```

Phase 08 完成时，TaskGraphScheduler 的 PRD 验收链路应更接近可长期运行系统的要求：关键状态变化可审计，CLI 错误可机器读取，消息持久化语义更清楚。
