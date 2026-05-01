# T097 Agent Message Team Context Intake

## 状态

`done`

## 目标

让 agent message intake 支持 `team_context` 和 delegation message。

## 范围

- 解析 `team_context`。
- 支持 `delegate_to_member`。
- 支持 `TASK_ASSIGNED` mailbox delivery。

## 验收标准

- delegation message 写入 target inbox。
- payload 保留 team context。
- delegation 不改变 workflow state。

## 关联代码

- `src/agent_message/intake.ts`
- `tests/agent_message_intake.test.ts`

## 实施记录

- `parseAgentMessagePayload` 支持 `team_context`。
- `intakeAgentMessage` 支持 `delegate_to_member`。
- delegation intake 要求 `nodeRegistrySnapshot`。
- delegation intake 要求 `team_context`。
- `TASK_ASSIGNED` delegation message 写入 target inbox。
- payload 保留 `team_context`。
- protocol validator 放行带 `action: delegate_to_member` 的 `TASK_ASSIGNED`。

## 验证

- `npm run typecheck` passed.
- `npm run build` passed.
- `node --test dist/tests/agent_message_intake.test.js` passed.
- `node --test dist/tests/message_bus.test.js` passed.
