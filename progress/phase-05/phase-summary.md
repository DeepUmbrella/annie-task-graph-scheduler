# Phase 05 Summary

## 阶段目标

实现跨项目调度基础能力，让 Annie 可以从多个项目 / workflow 中生成全局 ready task 队列，并基于项目优先级、用户优先级、风险和 Agent 负载输出跨项目 dispatch plan。

Phase 05 保持本地单进程、本地文件持久化边界，不做真正分布式调度、跨机器锁或多用户权限系统。

核心能力：

1. 定义跨项目调度模型。
2. 建立本地 Project Registry。
3. 从多个 workflow state 构建 global ready task queue。
4. 在 global queue 上进行优先级排序和调度规划。
5. 聚合全局 Agent 池和负载。
6. 提供 project / queue CLI 边界。
7. 补充 Phase 05 验收测试，确保不破坏 Phase 01-04。

## 阶段状态

`todo`

## 关联文档

- [PRD](../../docs/annie_task_graph_scheduler_prd%20(1).md)
- [Phase 05 Plan](../../docs/plans/phase-05-plan.md)
- [Phase 01 Summary](../phase-01/phase-summary.md)
- [Phase 02 Summary](../phase-02/phase-summary.md)
- [Phase 03 Summary](../phase-03/phase-summary.md)
- [Phase 04 Summary](../phase-04/phase-summary.md)

## Task 列表

| ID | 状态 | 任务 |
|---|---|---|
| T028 | done | [Cross-project 模型定义](./tasks/task-028-cross-project-model.md) |
| T029 | done | [Project Registry 与本地持久化](./tasks/task-029-project-registry.md) |
| T030 | done | [Global Queue Builder](./tasks/task-030-global-queue-builder.md) |
| T031 | done | [Cross-project Scheduler](./tasks/task-031-cross-project-scheduler.md) |
| T032 | done | [Global Agent Pool](./tasks/task-032-global-agent-pool.md) |
| T033 | done | [CLI project / queue 命令](./tasks/task-033-cli-project-queue.md) |
| T034 | todo | [Phase 05 验收测试](./tasks/task-034-phase-05-acceptance.md) |

## 当前进度

- Phase 01-04 已完成。
- Phase 05 任务已规划。
- 已完成 T028：Cross-project 模型定义。
- 已完成 T029：Project Registry 与本地持久化。
- 已完成 T030：Global Queue Builder。
- 已完成 T031：Cross-project Scheduler。
- 已完成 T032：Global Agent Pool。
- 已完成 T033：CLI project / queue 命令。
- 下一步进入 T034：Phase 05 验收测试。

## 阶段完成标准

1. 可以注册和列举本地项目。
2. 可以从多个 workflow state 构建 global ready task queue。
3. 可以根据项目优先级、用户优先级、风险和 Agent 负载生成 dispatch plan。
4. 可以聚合全局 Agent 池 capacity。
5. CLI 可以输出 project registry、queue 和 dispatch plan JSON。
6. Phase 01-04 回归测试继续通过。
7. Phase 05 新增验收测试通过。
