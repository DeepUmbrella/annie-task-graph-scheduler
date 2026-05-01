# T093 Registration Intake Semantics

## 状态

`todo`

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
