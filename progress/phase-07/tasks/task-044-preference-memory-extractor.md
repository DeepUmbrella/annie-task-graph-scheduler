# T044 Preference Memory Candidate Extractor

## 状态

`done`

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

## 完成记录

- 扩展 `src/memory/extractors.ts`。
- 新增 `extractPreferenceMemoryCandidates`。
- 从 ExecutionPolicy 提取 concurrency、risk、conflict preference candidates。
- 从 wave skipped_ready_tasks 提取 conflict / risk / concurrency / agent 调度信号。
- 仅生成候选，不修改 WorkflowState，不改变 plan schema。
- 扩展 `tests/memory.test.ts` 覆盖 policy preference 和 skipped reason signal。

## 验证结果

```txt
npm run typecheck
npm run build
npm test
105 passed
```
