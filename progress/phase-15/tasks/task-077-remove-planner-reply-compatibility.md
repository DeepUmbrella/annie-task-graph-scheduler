# T077 Remove Runtime-Specific Agent Message Routes

## 状态

`todo`

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
