# T093 Registration Intake Semantics

## 状态

`done`

## 目标

修正 registry registration 的授权语义。

## 范围

- `normalizeNodeRegistrationProposal` 不再默认授予 requested actions。
- `/nodes/register` 保持接收 proposal。
- 增加审批后 proposal 注册测试。

## 验收标准

- 缺少 `granted_actions` 时 registered node 的 `granted_actions` 为空。
- 已审批 proposal 的 `granted_actions` 被持久化。
- registry 不自动授予 discovery / requested 权限。

## 关联代码

- `src/node_registry/model.ts`
- `tests/node_registry.test.ts`
- `tests/inbound_server.test.ts`

## 实施记录

- `normalizeNodeRegistrationProposal` 不再把 `requested_actions` 默认复制为 `granted_actions`。
- 缺少 `granted_actions` 时 registered node 的授权为空数组。
- 已审批 proposal 的 `granted_actions` 可被持久化。
- registry 派生 action policy 只来自 `granted_actions`。

## 验证

- `npm run typecheck` passed.
- `npm run build` passed.
- `node --test dist/tests/node_registry.test.js` passed.
- `node --test dist/tests/inbound_server.test.js` passed.
- `node --test dist/tests/agent_message_intake.test.js` passed.
