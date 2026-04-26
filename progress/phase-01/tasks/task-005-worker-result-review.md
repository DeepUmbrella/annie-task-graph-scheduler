# T005 Worker Result Review

## 状态

`done`

## 完成记录

- 扩展 Task 结果字段。
- 实现 `assignWorkers(...)`。
- 实现 worker assignment 记录与审计事件生成。
- 实现 `validateWorkerTaskResult(...)`。
- 实现 `collectResult(...)`。
- 实现 `reviewWave(...)`。
- 支持成功结果进入 `reviewing`。
- 支持 ReviewGate 通过后任务进入 `done`。
- 支持失败任务与 changed files 冲突导致 ReviewGate 失败。

## 验证

```txt
npm run typecheck
npm run build
npm test
```

全部通过。

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
