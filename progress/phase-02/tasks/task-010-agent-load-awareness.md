# T010 Agent Load Awareness

## 状态

`done`

## 完成记录

- 新增任务可选字段 `required_capabilities`。
- 新增 `AgentRuntimeState`。
- `WorkflowState` 增加 `agents`。
- `WorkerPool` 支持 preferred agent、capability、负载和 fallback 分配。
- assignment 结果增加 decision。
- assignment audit event 增加负载决策信息。
- 补充 preferred agent 不可用、least-loaded capable agent 和无可用 Agent 测试。

## 验证

```txt
npm run typecheck
npm run build
npm test
```

全部通过。

## 目标

让 WorkerPool 在分配任务时考虑 Agent 当前负载和能力，避免同一个 Agent 被过度分配，也为后续真实 OpenClaw session 池打基础。

## 范围

- 新增 Agent registry / runtime state 模型。
- 记录 Agent 的能力、当前任务数、最大并发数和 session id。
- WorkerPool 分配时优先考虑：
  1. `preferred_agent`
  2. Agent capability
  3. 当前负载
  4. fallback agent
- 将 assignment 结果写入状态。
- 补充 Agent 满载、fallback、无可用 Agent 的测试。

## 建议模型

```txt
AgentRuntimeState
├── agent_id
├── capabilities
├── active_task_ids
├── max_concurrent_tasks
├── session_id
└── status
```

## 验收标准

- 同一 Agent 不超过 `max_concurrent_tasks`。
- preferred agent 可用时优先分配。
- preferred agent 满载时按策略 fallback 或等待。
- 没有可用 Agent 时任务不会进入 `running`。
- assignment audit event 包含负载决策信息。

## 关联代码

- `src/execution/worker_pool.ts`
- `src/models/workflow.ts`
- `src/models/plan.ts`
- `tests/execution.test.ts`
