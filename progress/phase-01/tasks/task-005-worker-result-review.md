# T005 Worker Result Review

## 状态

`todo`

## 目标

完成 M4：Worker 分配、结果收集与 ReviewGate。

## 范围

- 实现 WorkerPool。
- 实现 assignment 记录。
- 实现 ResultCollector。
- 校验 worker 结构化结果。
- 实现 ReviewGate。
- 支持成功、失败、冲突与 critical failure 处理。

## 验收标准

- 每个 wave task 都有 worker assignment。
- 分配失败时任务不会卡在 `running`。
- worker result 必须包含 `task_id`、`status`、`summary`。
- `TASK_COMPLETED` 结果可使任务进入 `reviewing`。
- ReviewGate 通过后任务进入 `done`。
- ReviewGate 失败时不允许调度下一 wave。

## 关联代码

- `src/execution/worker_pool.ts`
- `src/execution/result_collector.ts`
- `src/execution/review_gate.ts`

