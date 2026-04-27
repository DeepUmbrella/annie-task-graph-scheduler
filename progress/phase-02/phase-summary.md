# Phase 02 Summary

## 阶段目标

在 Phase 01 MVP 调度内核之上实现“增强调度”能力。

Phase 01 已经能生成合法 wave，并按依赖、并发上限、Agent 上限、风险和文件冲突做基础约束。Phase 02 的目标是让调度器从“规则可用”升级为“策略可调、风险可解释、负载可感知、失败可恢复”。

核心能力：

1. 引入可配置的调度策略模型。
2. 根据 Agent 当前负载和能力选择 worker。
3. 对任务进行风险评分，并影响 wave 排序与并发决策。
4. 将失败类型与重试策略配置化。
5. 增强文件冲突预测，从精确文件匹配扩展到目录、glob 和未知文件风险。
6. 让 Scheduler 输出更完整的调度解释。
7. 补充端到端测试，证明 Phase 02 策略不会破坏 Phase 01 MVP 流程。

## 阶段状态

`in_progress`

## 关联文档

- [PRD](../../docs/annie_task_graph_scheduler_prd%20(1).md)
- [Implementation Plan](../../docs/task_graph_scheduler_implementation_plan.md)
- [Phase 01 Summary](../phase-01/phase-summary.md)

## Task 列表

| ID | 状态 | 任务 |
|---|---|---|
| T009 | done | [Phase 02 策略模型与配置](./tasks/task-009-scheduling-policy-model.md) |
| T010 | todo | [Agent 负载感知](./tasks/task-010-agent-load-awareness.md) |
| T011 | todo | [任务风险评分](./tasks/task-011-risk-scoring.md) |
| T012 | todo | [自动重试策略配置](./tasks/task-012-retry-policy.md) |
| T013 | todo | [增强文件冲突预测](./tasks/task-013-conflict-prediction.md) |
| T014 | todo | [Scheduler 策略集成与解释输出](./tasks/task-014-scheduler-policy-integration.md) |
| T015 | todo | [Phase 02 验收与回归测试](./tasks/task-015-phase-02-acceptance.md) |

## 当前进度

- Phase 01 MVP 已完成。
- Phase 02 任务已规划。
- 已完成 T009：Phase 02 策略模型与配置。
- 下一步进入 T010：Agent 负载感知。

## 阶段完成标准

1. Execution Policy 支持 Phase 02 调度策略配置。
2. WorkerPool 能根据 Agent 负载和能力进行分配。
3. Scheduler 能根据风险评分调整 wave 选择。
4. 失败处理能根据 failure type 和 retry policy 自动决定是否重试。
5. 文件冲突预测支持精确文件、目录、glob 和未知文件风险。
6. Scheduler 能解释任务入选或跳过的策略原因。
7. Phase 01 的 43 个测试继续通过。
8. Phase 02 新增策略测试和 e2e 验收测试通过。
