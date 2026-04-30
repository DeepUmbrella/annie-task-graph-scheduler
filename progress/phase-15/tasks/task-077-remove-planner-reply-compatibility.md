# T077 Remove Planner Reply Compatibility

## 状态

`todo`

## 目标

移除旧 planner-specific endpoint 和 compatibility wrapper。

## 范围

- 删除 `/openclaw/planner-replies` endpoint。
- 删除 `receivePlannerReply`。
- 删除 `src/planner_reply/*`。
- 删除 `tests/planner_reply_intake.test.ts`。
- 更新 inbound server tests。

## 验收标准

- `rg "planner-replies|receivePlannerReply|planner_reply|intakePlannerReply"` 不再命中运行时代码和测试。
- `/openclaw/agent-messages` 是唯一 agent reply intake endpoint。

## 关联代码

- `src/server/inbound_server.ts`
- `src/planner_reply/*`
- `tests/inbound_server.test.ts`
- `tests/planner_reply_intake.test.ts`
