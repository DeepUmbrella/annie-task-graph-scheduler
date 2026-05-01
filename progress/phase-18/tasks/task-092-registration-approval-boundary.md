# T092 Registration Approval Boundary

## 状态

`todo`

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
