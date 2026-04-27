# Phase 07 Plan: Long-term Memory Integration Boundary

## Context

Phase 01-06 已完成 TaskGraphScheduler 的本地可运行闭环：

- DAG 调度内核。
- 增强调度策略。
- 可视化投影。
- 任务模板。
- 跨项目调度。
- 单 workflow 执行 CLI 编排。

PRD 后续规划中仍未落地的一项是“长期记忆接入”：

- 将高质量执行结果写入 Annie Memory。
- 记录用户偏好的并发策略。
- 记录项目常见任务模板。

当前仓库没有真实 Annie Memory 服务、SDK 或协议定义。Phase 07 因此只实现稳定边界和本地 mock / file store，让 TaskGraphScheduler 能产出可持久化、可导出、可测试的 memory candidates。真实 Annie Memory adapter 需要等用户提供接口约定后再接入。

## Scope

Phase 07 做：

- 定义 MemoryRecord / MemoryCandidate / MemoryAdapter 边界。
- 从 workflow execution / review result 中提取高质量结果候选。
- 从 execution policy 和 scheduler decisions 中提取用户偏好候选。
- 从 template usage / task shape 中提取项目常见任务模板候选。
- 提供本地 JSONL MemoryStore 作为 mock adapter。
- 提供 CLI 输出和写入本地 memory records。

Phase 07 不做：

- 不接真实 Annie Memory 远端服务。
- 不引入新 runtime dependency。
- 不改变 plan schema。
- 不把所有任务结果无条件写入长期记忆。
- 不自动上传敏感文件内容。

## Tasks

### T042 Memory model and adapter boundary

- 新增 `src/memory/model.ts`
- 定义 `MemoryRecord`
- 定义 `MemoryCandidate`
- 定义 `MemoryAdapter`
- 定义 memory category / confidence / provenance

### T043 Execution memory candidate extractor

- 新增 `src/memory/extractors.ts`
- 从 WorkflowState 提取高质量执行结果 candidate
- 只提取 done task / passed wave / successful workflow
- 保留 source workflow / wave / task provenance

### T044 Preference memory candidate extractor

- 从 ExecutionPolicy、WaveDecision、scheduler skipped reason 中提取用户偏好 candidate
- 记录并发限制、risk preference、conflict policy 等偏好
- 不改变现有 policy，只生成候选

### T045 Template memory candidate extractor

- 从成功 workflow 的 task graph shape 中提取常见模板候选
- 记录 project / tags / task pattern
- 不直接写入 TemplateRegistry，只生成 candidate

### T046 Local memory store

- 新增 `src/memory/local_store.ts`
- 使用 JSONL 保存 MemoryRecord
- 支持 append / list / findByCategory
- 支持 deterministic id 或稳定 source key 去重

### T047 CLI memory commands

- 扩展 `src/cli.ts`
- `memory extract --workflow <workflow_id>`
- `memory write --workflow <workflow_id>`
- `memory list [--category <category>]`
- 输出 JSON

### T048 Phase 07 acceptance

- 单元测试：model / extractor / local store
- e2e 测试：CLI extract / write / list
- 回归测试：Phase 01-06 不受影响
- 更新 progress README 和 agent.md

## Key Files

- `src/memory/model.ts` — 新增
- `src/memory/extractors.ts` — 新增
- `src/memory/local_store.ts` — 新增
- `src/memory/index.ts` — 新增
- `src/cli.ts` — 扩展
- `tests/memory.test.ts` — 新增
- `tests/e2e_memory_cli.test.ts` — 新增

## Verification

```txt
npm run typecheck
npm run build
npm test
```

Phase 07 完成时，TaskGraphScheduler 应能从本地 workflow state 中提取长期记忆候选，并写入本地 JSONL memory store。真实 Annie Memory 远端接入需要另开后续 phase，并在实现前确认接口细节。
