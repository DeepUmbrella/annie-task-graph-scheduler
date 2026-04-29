# T061 Intent Planner Handoff

## 状态

`done`

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

## 完成记录

- 新增 `PLANNING_REQUEST` message type。
- ProtocolValidator 允许 orchestrator 向 agent 发送 `PLANNING_REQUEST`。
- 新增 `handoffIntentToPlanner`。
- planning request payload 包含 `intent_id`、`goal`、`team_id` 和 `required_output: TaskDagPlan`。
- message 写入 controller inbox 和 orchestrator outbox。
- 不调用真实 OpenClaw session。

## 验证结果

```txt
npm run typecheck: pass
npm run build: pass
npm test: 129 passed
```
