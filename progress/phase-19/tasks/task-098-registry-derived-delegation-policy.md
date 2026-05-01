# T098 Registry-Derived Delegation Policy

## 状态

`done`

## 目标

从 registered node 的 `granted_actions` 派生 delegation permission。

## 范围

- 扩展 node registry action policy builder。
- 保持未授权默认拒绝。
- 增加 registry-derived delegation tests。

## 验收标准

- `granted_actions: ["delegate_to_member"]` 派生 `TASK_ASSIGNED` 权限。
- 缺少 grant 时不派生。

## 关联代码

- `src/node_registry/policy.ts`
- `tests/agent_message_intake.test.ts`

## 实施记录

- `buildAgentActionPolicyFromNodeRegistry` 支持 `delegate_to_member`。
- `granted_actions: ["delegate_to_member"]` 派生 `TASK_ASSIGNED` permission。
- 缺少 grant 时不派生 delegation permission。

## 验证

- `npm run typecheck` passed.
- `npm run build` passed.
- `node --test dist/tests/agent_message_intake.test.js` passed.
- `node --test dist/tests/agent_action.test.js` passed.
- `node --test dist/tests/team_delegation.test.js` passed.
