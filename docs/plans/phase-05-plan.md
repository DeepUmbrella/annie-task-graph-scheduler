# Phase 05 Plan: Cross-project Scheduling

## Context

Phase 01-04 已完成单 workflow 调度内核、增强调度、可视化投影和任务模板系统。Phase 05 对应 PRD 后续规划中的“跨项目调度”：

- 多项目任务队列。
- 全局 Agent 池。
- 用户级优先级调度。

Phase 05 仍保持本地单进程 / 本地文件持久化边界，不实现真正分布式调度、跨机器锁或多用户权限系统。目标是为 Annie 后续接入多个项目、多个 workflow 和统一 Agent 资源池打基础。

## Tasks

### T028 Cross-project 模型定义

- 新增 `src/models/project.ts`
- 定义 `ProjectRef`、`ProjectWorkflowRef`、`GlobalTaskQueueItem`
- 定义 `UserPriority` / `ProjectPriority` 基础类型
- 定义 `GlobalAgentRuntimeState`
- 设计多项目调度所需的稳定 ID 字段

### T029 Project Registry 与本地持久化

- 新增 `src/projects/registry.ts`
- 支持 register / get / list / update project
- 使用本地 JSON 文件持久化 project registry
- 与现有 `.annie/workflows/<workflow_id>` 状态结构保持兼容

### T030 Global Queue Builder

- 新增 `src/projects/global_queue.ts`
- 从多个 workflow state 中收集 ready tasks
- 生成 `GlobalTaskQueueItem[]`
- 队列项包含 project、workflow、task、risk、priority、agent requirement
- 支持过滤 blocked / failed / done tasks

### T031 Cross-project Scheduler

- 新增 `src/projects/cross_project_scheduler.ts`
- 在 global queue 上执行调度
- 支持项目优先级、用户优先级、风险和 Agent 负载综合排序
- 输出 cross-project dispatch plan
- 不直接修改各 workflow state

### T032 Global Agent Pool

- 新增 `src/projects/agent_pool.ts`
- 聚合多个 workflow 的 AgentRuntimeState
- 支持 Agent capacity 统计
- 支持能力匹配和负载计算
- 与 Phase 02 WorkerPool 策略保持一致

### T033 CLI project / queue 命令

- 扩展 `src/cli.ts`
- `project register`
- `project list`
- `project show`
- `queue build`
- `queue plan`
- 输出 JSON，供外部 UI 或 Annie Orchestrator 使用

### T034 Phase 05 验收测试

- 单元测试：project registry
- 单元测试：global queue builder
- 单元测试：cross-project scheduler priority ordering
- 单元测试：global agent pool capacity
- CLI 测试：project / queue 命令
- 回归测试：Phase 01-04 不受影响
- 更新 progress、README 和 agent.md

## Key Files

- `src/models/project.ts` — 新增
- `src/projects/registry.ts` — 新增
- `src/projects/global_queue.ts` — 新增
- `src/projects/cross_project_scheduler.ts` — 新增
- `src/projects/agent_pool.ts` — 新增
- `src/projects/index.ts` — 新增
- `src/cli.ts` — 扩展
- `tests/project_registry.test.ts` — 新增
- `tests/cross_project_scheduler.test.ts` — 新增
- `tests/e2e_phase_05.test.ts` — 新增

## Verification

```txt
npm run typecheck
npm run build
npm test
```

Phase 05 完成时，应能从多个本地 workflow state 生成跨项目 ready task 队列，并输出不修改状态的 dispatch plan。

