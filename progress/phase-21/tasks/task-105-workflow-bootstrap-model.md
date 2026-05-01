# T105 Workflow Bootstrap Model

## 状态

`done`

## 目标

定义 workflow bootstrap input / result。

## 范围

- 新增 `src/workflow_bootstrap/*`。
- 定义 `WorkflowBootstrapInput`。
- 定义 `WorkflowBootstrapResult`。
- 定义 workflow id 生成规则。

## 验收标准

- bootstrap input 可指定 proposal id。
- workflow id 可指定或自动生成。

## 关联代码

- `src/workflow_bootstrap/*`
- `tests/workflow_bootstrap.test.ts`

## 实施记录

- 新增 `WorkflowBootstrapInput`。
- 新增 `WorkflowBootstrapResult`。
- 新增 `createWorkflowIdFromProposal`。

## 验证

- `npm run typecheck` passed.
- `npm run build` passed.
- `node --test dist/tests/workflow_bootstrap.test.js` passed.
