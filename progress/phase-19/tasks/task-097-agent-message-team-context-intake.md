# T097 Agent Message Team Context Intake

## 状态

`todo`

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
