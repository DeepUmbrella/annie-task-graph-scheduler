# T075 Agent Action Policy Model

## 状态

`todo`

## 目标

定义每个 agent / node 可以执行哪些 action。

## 范围

- 新增 `src/agent_action/*`。
- 定义 action type，最小支持 `send_message`。
- 定义 policy / permission model。
- 提供默认 local policy。

## 验收标准

- 可以校验 agent 是否允许执行 action。
- 可以校验 action 是否允许发送指定 message type。
- 测试覆盖允许和拒绝路径。

## 关联代码

- `src/agent_action/*`
- `tests/agent_action.test.ts`
