# T083 Team Context And Action Policy Integration

## 状态

`todo`

## 目标

提供 team context validation，并允许从 registered nodes 派生 action policy。

## 范围

- 实现 `validateTeamContext`。
- 实现 `buildAgentActionPolicyFromNodeRegistry`。
- 保留默认 policy fallback。

## 验收标准

- member 属于 team 时通过。
- 非 member 声称 team context 时失败。
- registry 派生的 action policy 可用于 `intakeAgentMessage`。

## 关联代码

- `src/node_registry/*`
- `src/agent_message/intake.ts`
- `tests/node_registry.test.ts`
- `tests/agent_message_intake.test.ts`
