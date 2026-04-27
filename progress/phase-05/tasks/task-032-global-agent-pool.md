# T032 Global Agent Pool

## 状态

`done`

## 目标

聚合多个 workflow 的 AgentRuntimeState，形成全局 Agent 池视图。

## 范围

- 新增 `src/projects/agent_pool.ts`。
- 合并同名 Agent。
- 汇总 active task count。
- 汇总 max capacity。
- 支持 capability matching。
- 支持 offline / busy / idle 状态计算。

## 验收标准

- 多 workflow 同名 Agent 可以合并。
- capacity 计算正确。
- offline Agent 不可分配。
- capability matching 与 Phase 02 WorkerPool 语义一致。

## 关联代码

- `src/projects/agent_pool.ts`
- `src/models/workflow.ts`
- `tests/cross_project_scheduler.test.ts`

## 完成记录

- 新增 `src/projects/agent_pool.ts`。
- 实现 `buildGlobalAgentPool`，支持多 workflow AgentRuntimeState 聚合。
- 同名 Agent 会合并 capabilities、project_ids、workflow_ids、active_global_task_ids，并汇总 max_concurrent_tasks。
- offline Agent 的 remaining capacity 计为 0，确保不可分配。
- 实现 `canGlobalAgentRunTask`，保持与 Phase 02 WorkerPool 一致的 capability / offline / capacity 判断。
- 补充 Global Agent Pool 单元测试。

## 验证结果

```txt
npm run typecheck
npm run build
npm test
88 passed
```
