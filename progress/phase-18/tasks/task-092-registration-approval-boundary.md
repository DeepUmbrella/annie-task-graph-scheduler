# T092 Registration Approval Boundary

## 状态

`done`

## 目标

实现 action approval boundary，明确 requested actions 不会自动变成 granted actions。

## 范围

- 定义 `NodeRegistrationApprovalPolicy`。
- 实现 `approveNodeRegistrationProposal`。
- 支持按 node / 全局 allowlist 过滤 action。

## 验收标准

- 默认 policy 不授予 action。
- allowlist policy 只授予允许的 action。
- approval 不修改 declared capabilities。

## 关联代码

- `src/node_registration_interview/approval.ts`
- `tests/node_registration_interview.test.ts`

## 实施记录

- 新增 `NodeRegistrationApprovalPolicy`。
- 新增 `createDenyAllRegistrationApprovalPolicy()`。
- 新增 `approveNodeRegistrationProposal(proposal, policy)`。
- 默认 policy 不授予 action。
- allowlist policy 只授予 node 已请求且被允许的 action。
- approval 不修改 declared capabilities。

## 验证

- `npm run typecheck` passed.
- `npm run build` passed.
- `node --test dist/tests/node_registration_interview.test.js` passed.
