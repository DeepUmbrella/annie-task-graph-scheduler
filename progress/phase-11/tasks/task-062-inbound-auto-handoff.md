# T062 Inbound Auto-Handoff

## 状态

`todo`

## 目标

inbound server 创建 workflow intent 后，自动 handoff 给 team controller / planner agent。

## 范围

- 扩展 `src/server/inbound_server.ts`。
- 串联 intent creation 和 planner handoff。
- HTTP response 返回 planner handoff metadata。
- 终端打印 `[annie-tgs:planner]` log。

## 验收标准

- `POST /openclaw/messages` 创建 intent 后写入 planner mailbox。
- response 包含 `planner_agent_id` 和 mailbox path。
- 终端可观察 handoff log。
- 不调用真实 OpenClaw session。

## 关联代码

- `src/server/inbound_server.ts`
- `src/planning/*`
- `tests/inbound_server.test.ts`
