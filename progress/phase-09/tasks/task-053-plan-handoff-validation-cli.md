# T053 Plan Handoff Validation CLI

## 状态

`todo`

## 目标

提供 `plan validate --plan <plan.json>`，用于校验 WritingPlansWorkflow 输出的 Task DAG handoff 文件。

## 范围

- 扩展 `src/cli.ts`。
- 复用现有 plan loader / DAG validator。
- 输出 plan metadata、task count、topological order、policy summary。
- 增加 CLI e2e 测试。

## 验收标准

- 合法 DAG 输出结构化 JSON 摘要。
- 非 DAG / 循环依赖等错误复用结构化错误。
- `--json-errors` 可输出机器可读错误。
- 不改变 plan schema。

## 关联代码

- `src/cli.ts`
- `src/validation/*`
- `tests/e2e_handoff_cli.test.ts`
