# T062 Inbound Auto-Handoff

## 状态

`done`

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

## 完成记录

- inbound server 创建 workflow intent 后会自动生成 `PLANNING_REQUEST`。
- handoff 消息写入 `team-lead-agent` mailbox。
- HTTP response 返回 `planner_agent_id`、`planner_inbox_path` 和 `planning_message_id`。
- 终端打印 `[annie-tgs:planner]` handoff log。
- smoke-test 文档已同步 planner handoff 观察点。

## 验证结果

```txt
npm run typecheck: pass
npm run build: pass
npm test: 129 passed
```
