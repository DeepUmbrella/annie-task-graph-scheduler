# T077 Remove Runtime-Specific Agent Message Routes

## 状态

`done`

## 目标

移除 runtime-specific agent message endpoint、旧 planner-specific endpoint 和 compatibility wrapper。

## 范围

- 新增 `/agent-messages` endpoint。
- 删除 `/openclaw/agent-messages` endpoint。
- 删除 `/openclaw/planner-replies` endpoint。
- 删除 `receivePlannerReply`。
- 删除 `src/planner_reply/*`。
- 删除 `tests/planner_reply_intake.test.ts`。
- 更新 inbound server tests。

## 验收标准

- `rg "openclaw/agent-messages|planner-replies|receivePlannerReply|planner_reply|intakePlannerReply"` 不再命中运行时代码和测试。
- `/agent-messages` 是唯一 agent message intake endpoint。

## 关联代码

- `src/server/inbound_server.ts`
- `src/planner_reply/*`
- `tests/inbound_server.test.ts`
- `tests/planner_reply_intake.test.ts`

## 完成记录

- 新增 runtime-neutral `/agent-messages` 处理路径。
- 删除 `/openclaw/agent-messages` agent message intake 路径。
- 删除 `/openclaw/planner-replies` 路径。
- 删除 `receivePlannerReply`。
- 删除 `src/planner_reply/*`。
- 删除 `tests/planner_reply_intake.test.ts`。
- CLI startup metadata 只暴露 `agent_messages`。

## 验证结果

```txt
npm run typecheck: pass
npm run build: pass
node --test dist/tests/agent_message_intake.test.js: 7 passed
node --test dist/tests/inbound_server.test.js: 3 passed
rg "openclaw/agent-messages|planner-replies|receivePlannerReply|planner_reply|intakePlannerReply" src tests: no matches
```
