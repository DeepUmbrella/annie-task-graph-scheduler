# T054 Workflow Execution Report

## 状态

`todo`

## 目标

提供结构化 workflow execution report，作为 ExecutionWorkflow / Delivery 阶段的本地 handoff 输出。

## 范围

- 新增 report projection。
- 从 `WorkflowState` 输出 workflow、task、wave、failure、audit-oriented metadata 摘要。
- 增加 CLI `report --workflow <workflow_id>`。
- 增加单元测试和 CLI e2e 测试。

## 验收标准

- report 输出稳定 JSON。
- completed / failed / blocked task 计数正确。
- wave review 状态可读。
- 不读取或输出文件正文。

## 关联代码

- `src/reporting/*`
- `src/cli.ts`
- `tests/reporting.test.ts`
- `tests/e2e_handoff_cli.test.ts`
