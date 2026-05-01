# T098 Registry-Derived Delegation Policy

## 状态

`todo`

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
