# Phase 09 Plan: Workflow Handoff Contract

## Context

Phase 01-08 已经完成 TaskGraphScheduler 的调度、执行、可视化、模板、跨项目、记忆和 PRD hardening 能力。

PRD 集成验收中还需要更清楚地表达：

- `WritingPlansWorkflow` 如何把 Task DAG 交给 TaskGraphScheduler。
- `ExecutionWorkflow` 如何读取、校验并运行 Task DAG。
- 执行完成后如何输出可被上游/下游 workflow 消费的结构化结果。

当前没有真实 Annie Workflow System 的接口定义，因此 Phase 09 只实现本地 handoff contract、CLI 校验入口和执行报告，不接真实远端 workflow。

## Scope

Phase 09 做：

- 提供 plan handoff validate CLI，用于校验 WritingPlansWorkflow 输出的 Task DAG。
- 提供 workflow execution report，用于 ExecutionWorkflow / Delivery 阶段读取执行结果。
- 增加 handoff examples / fixtures，说明上游计划输入和下游执行报告输出。
- 增加 e2e acceptance 测试覆盖 handoff contract。

Phase 09 不做：

- 不接真实 Annie Workflow System API。
- 不改变 plan schema。
- 不引入新 runtime dependency。
- 不自动执行代码修改。
- 不实现 UI。

## Tasks

### T053 Plan handoff validation CLI

- 扩展 `src/cli.ts`。
- 增加 `plan validate --plan <plan.json>`。
- 输出标准化 plan metadata、task count、topological order、policy summary。
- 错误复用 `TaskGraphSchedulerError` 和 `--json-errors`。

### T054 Workflow execution report

- 新增 execution report projection。
- 从 `WorkflowState` 输出 workflow status、task summary、wave summary、audit-oriented handoff metadata。
- 增加 CLI `report --workflow <workflow_id>`。

### T055 Handoff examples and docs

- 新增 handoff example plan。
- 新增 docs 说明 WritingPlansWorkflow 输出和 ExecutionWorkflow 读取方式。
- 记录 report 输出的稳定字段。

### T056 Phase 09 acceptance

- 增加 e2e 测试覆盖 plan validate 和 report。
- 跑通 typecheck/build/test。
- 更新 progress README 和 agent.md。

## Verification

```txt
npm run typecheck
npm run build
npm test
```

Phase 09 完成时，TaskGraphScheduler 应能清楚表达本地 workflow handoff contract：上游生成的 DAG 可被校验，下游可读取结构化执行报告，真实 Annie Workflow API 留到接口明确后的后续阶段。
