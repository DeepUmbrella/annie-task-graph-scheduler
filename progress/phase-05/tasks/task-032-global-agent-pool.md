# T032 Global Agent Pool

## 状态

`todo`

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

