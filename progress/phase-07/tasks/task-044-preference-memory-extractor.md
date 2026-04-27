# T044 Preference Memory Candidate Extractor

## 状态

`todo`

## 目标

从 execution policy 和 scheduler decisions 中提取用户偏好 memory candidates。

## 范围

- 扩展 `src/memory/extractors.ts`。
- 提取 max_parallel_tasks、max_agents、risk policy、conflict policy。
- 提取 scheduler skipped reason 中反复出现的调度偏好信号。
- 只生成 candidate，不自动修改 policy。

## 验收标准

- ExecutionPolicy 可生成 preference candidates。
- candidate 包含 confidence 和 reason。
- 不改变现有 WorkflowState。
- 不改变 plan schema。

## 关联代码

- `src/memory/extractors.ts`
- `src/models/plan.ts`
- `tests/memory.test.ts`
