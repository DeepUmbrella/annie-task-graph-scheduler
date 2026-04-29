# T061 Intent Planner Handoff

## 状态

`todo`

## 目标

将 workflow intent 转换成 planner agent mailbox 中的一条 `PLANNING_REQUEST` 消息。

## 范围

- 新增 `PLANNING_REQUEST` message type。
- 新增 `src/planning/*`。
- 创建 planning request message。
- 写入 planner agent inbox / orchestrator outbox。

## 验收标准

- message payload 包含 `intent_id` 和 `goal`。
- message 写入 `team-lead-agent` inbox。
- message direction 合法。
- 不触发真实 OpenClaw session。

## 关联代码

- `src/models/message.ts`
- `src/communication/protocol_validator.ts`
- `src/planning/*`
- `tests/planning_handoff.test.ts`
