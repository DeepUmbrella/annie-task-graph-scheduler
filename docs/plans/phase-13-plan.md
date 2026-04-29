# Phase 13 Plan: Planner Reply Intake And Clarification Loop

## 背景

Phase 12 已经可以把 `PLANNING_REQUEST` 投递给真实 OpenClaw planner agent。真实 `develop-team` 已经能回复需求澄清问题。

Phase 13 的最小目标是把真实 planner 的自然语言回复接回 TaskGraphScheduler，并保存为结构化 Annie message。

## 边界

本阶段做：

- 新增 `REQUIREMENT_CLARIFICATION_REQUEST` message type。
- 允许 planner agent 向 Annie / orchestrator 发需求澄清请求。
- 提供 planner reply intake 能力，把真实 OpenClaw 回复落到 mailbox。
- 提供 HTTP endpoint，便于 OpenClaw/webhook/手工回写 planner 回复。

本阶段不做：

- 不解析 TaskDagPlan。
- 不自动回答澄清问题。
- 不生成 DAG。
- 不调度执行 agent。

## Task 列表

### T067 Clarification message protocol

- 新增 `REQUIREMENT_CLARIFICATION_REQUEST` message type。
- 更新 ProtocolValidator 方向规则。
- 补充协议单元测试。

### T068 Planner reply intake

- 新增 planner reply intake 模块。
- 从 payload 中读取 `intent_id`、`from`、`message` / `text`。
- 提取澄清问题列表。
- 写入 Annie mailbox。

### T069 Planner reply HTTP endpoint

- 新增 `POST /openclaw/planner-replies`。
- 返回结构化 message metadata。
- 更新 smoke-test 文档。

### T070 Phase 13 acceptance

- 跑通 `npm run typecheck`。
- 跑通 `npm run build`。
- 跑通 `npm test`。
- 更新 progress README 和 agent handoff 状态。

## 验收标准

真实 planner 回复可以通过 HTTP 回写：

```txt
POST /openclaw/planner-replies
```

并生成：

```txt
.annie/workflows/<intent_id>/mailboxes/annie/inbox.jsonl
```

其中消息类型为 `REQUIREMENT_CLARIFICATION_REQUEST`。
