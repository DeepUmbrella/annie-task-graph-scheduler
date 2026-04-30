# T083 Team Context And Action Policy Integration

## 状态

`done`

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

## 实施记录

- 新增 `validateTeamContext(snapshot, nodeId, context)`。
- 校验 node 必须已注册。
- 校验 team composition 必须存在。
- 校验 node 必须属于 claimed team。
- 可选校验 claimed role 与 team composition role 一致。
- 新增 `buildAgentActionPolicyFromNodeRegistry(snapshot)`。
- action policy 只从 active node 的 `granted_actions` 派生。
- 抽出共享 `createSendMessagePermission()`，避免默认 policy 和 registry policy 分叉。

## 验证

- `npm run typecheck` passed.
- `npm run build` passed.
- `node --test dist/tests/node_registry.test.js` passed.
- `node --test dist/tests/agent_action.test.js` passed.
- `node --test dist/tests/agent_message_intake.test.js` passed.
