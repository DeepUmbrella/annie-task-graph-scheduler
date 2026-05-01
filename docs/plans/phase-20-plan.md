# Phase 20 Plan: Plan Proposal Intake

## 背景

前面阶段已经能把用户意图交给 team/planner，也能接收通用 agent message。下一步需要接收 planner/team 返回的 DAG 计划提案。

关键产品规则：

```txt
Plan proposal intake validates and stores a TaskDagPlan.
Plan proposal intake does not automatically initialize workflow state.
Execution remains an explicit later step.
```

## 目标

实现最小 Plan Proposal Intake：

- 定义 `PlanProposal` 模型。
- 从 runtime reply 中解析 `TaskDagPlan`。
- 使用现有 `loadPlan` / DAG validation。
- 持久化 proposal snapshot。
- 提供 runtime-neutral endpoint。

## 边界

本阶段做：

- 新增 `src/plan_proposal/*`。
- 支持 object / text / fenced JSON 解析。
- 保存 `.annie/plans/proposals.json`。
- 新增 `POST /plan-proposals`。
- 新增 `GET /plan-proposals`。

本阶段不做：

- 不自动创建 WorkflowState。
- 不自动调度 next-wave。
- 不调用 OpenClaw。
- 不做 plan approval UI。

## Task 列表

### T100 Plan proposal model and parser

- 定义 `PlanProposal`。
- 定义 `PlanProposalIntakePayload`。
- 解析 object / text / fenced JSON。
- 使用 `loadPlan` 校验 DAG。

### T101 Plan proposal store

- 实现 `.annie/plans/proposals.json`。
- 支持保存 proposal。
- 支持读取 proposal list。

### T102 Plan proposal endpoint

- 新增 `POST /plan-proposals`。
- 新增 `GET /plan-proposals`。
- `serve` 输出 endpoints。

### T103 Plan proposal intake tests

- 覆盖 valid proposal。
- 覆盖 invalid DAG。
- 覆盖 fenced JSON。
- 确认不会创建 workflow state。

### T104 Phase 20 acceptance

- 更新 PRD implementation status。
- 更新 progress README 和 agent handoff 状态。
- 跑通 `npm run typecheck`、`npm run build`、`npm test`。

## 验收标准

1. 可以接收 valid TaskDagPlan proposal。
2. invalid DAG 被结构化拒绝。
3. proposal 可持久化读取。
4. endpoint runtime-neutral。
5. intake 不初始化 workflow state。
6. Phase 01-19 回归测试继续通过。
