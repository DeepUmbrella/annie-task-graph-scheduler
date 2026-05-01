# T106 Bootstrap From Proposal

## 状态

`done`

## 目标

从 plan proposal 创建 workflow state。

## 范围

- 加载 plan proposal。
- 创建 initial workflow state。
- 保存 state。
- 写 audit event。

## 验收标准

- state 文件被创建。
- audit 记录 bootstrap 事件。
- missing proposal 返回结构化错误。

## 关联代码

- `src/workflow_bootstrap/bootstrap.ts`
- `tests/workflow_bootstrap.test.ts`

## 实施记录

- 新增 `bootstrapWorkflowFromProposal`。
- 从 proposal store 加载 proposal。
- 使用 `createInitialWorkflowState` 创建 workflow state。
- 保存 state。
- 写入 `WORKFLOW_BOOTSTRAPPED` audit event。
- missing proposal 返回 `PLAN_PROPOSAL_NOT_FOUND`。

## 验证

- `npm run typecheck` passed.
- `npm run build` passed.
- `node --test dist/tests/workflow_bootstrap.test.js` passed.
