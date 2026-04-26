# Phase 01 Summary

## 阶段目标

交付一个本地可运行、可恢复、可审计的 TaskGraphScheduler MVP。

核心能力：

1. 读取 `WritingPlansWorkflow` 输出的 DAG plan。
2. 校验 DAG 格式、依赖引用和循环依赖。
3. 计算 ready / blocked tasks。
4. 根据并发上限、Agent 上限、风险和文件冲突生成 wave。
5. 记录 worker 分配。
6. 收集结构化任务结果。
7. 执行 wave 级 ReviewGate。
8. 持久化 workflow state、mailbox 和 audit log。
9. 支持中断恢复。

## 阶段状态

`in_progress`

## 关联文档

- [PRD](../../docs/annie_task_graph_scheduler_prd%20(1).md)
- [Implementation Plan](../../docs/task_graph_scheduler_implementation_plan.md)

## Task 列表

| ID | 状态 | 任务 |
|---|---|---|
| T001 | done | [项目初始化](./tasks/task-001-project-initialization.md) |
| T002 | done | [模型与 DAG 校验](./tasks/task-002-models-and-dag-validation.md) |
| T003 | done | [状态存储与依赖解析](./tasks/task-003-state-store-and-dependency-resolver.md) |
| T004 | done | [Wave 调度与冲突检测](./tasks/task-004-wave-scheduling-and-conflict-detection.md) |
| T005 | done | [Worker 分配、结果收集与 ReviewGate](./tasks/task-005-worker-result-review.md) |
| T006 | todo | [MessageBus 与 Mailbox](./tasks/task-006-message-bus-and-mailbox.md) |
| T007 | todo | [恢复机制与端到端验收](./tasks/task-007-recovery-and-e2e.md) |
| T008 | todo | [OpenClaw Adapter 集成](./tasks/task-008-openclaw-adapter.md) |

## 当前进度

- 已完成 TypeScript 项目初始化。
- 已建立源码、测试、fixtures 和文档目录骨架。
- 已完成初始 git 提交：`01aff57 chore: initialize task graph scheduler project`。
- 已完成 T002：模型与 DAG 校验。
- 已完成 T003：状态存储与依赖解析。
- 已完成 T004：Wave 调度与冲突检测。
- 已完成 T005：Worker 分配、结果收集与 ReviewGate。
- 下一步进入 T006：MessageBus 与 Mailbox。

## 阶段完成标准

1. 可以从合法 DAG plan 初始化 workflow。
2. 可以拒绝非法 plan 和循环依赖 plan。
3. 可以按依赖关系生成正确 wave。
4. 可以根据 `max_parallel_tasks`、`max_agents` 和文件冲突限制 wave。
5. 可以记录 worker assignment。
6. 可以接收结构化结果并进入 ReviewGate。
7. 可以处理任务失败并阻塞下游。
8. 可以持久化 state、mailbox 和 audit log。
9. 可以从中断状态恢复。
10. 可以通过 e2e fixture 复现 PRD 中的完整执行过程。
