# T100 Plan Proposal Model And Parser

## 状态

`done`

## 目标

定义并解析 planner/team 返回的 plan proposal。

## 范围

- 新增 `src/plan_proposal/*`。
- 定义 `PlanProposal`。
- 支持 object / text / fenced JSON。
- 使用 `loadPlan` 校验 DAG。

## 验收标准

- valid TaskDagPlan 可解析。
- fenced JSON 可解析。
- invalid DAG 返回结构化错误。

## 关联代码

- `src/plan_proposal/*`
- `tests/plan_proposal.test.ts`

## 实施记录

- 新增 `PlanProposal`。
- 新增 `PlanProposalIntakePayload`。
- 新增 `parsePlanProposalPayload`。
- 支持 object plan。
- 支持 text/content/reply/message 中的 JSON。
- 支持 fenced JSON。
- 使用 `loadPlan` 校验 TaskDagPlan。

## 验证

- `npm run typecheck` passed.
- `npm run build` passed.
- `node --test dist/tests/plan_proposal.test.js` passed.
