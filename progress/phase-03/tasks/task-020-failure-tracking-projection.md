# T020 Failure Tracking Projection

## 状态

`todo`

## 目标

生成失败任务追踪数据，让用户快速看到失败类型、重试次数、阻塞下游和建议处理方式。

## 范围

- 收集 failed tasks。
- 收集 blocked tasks。
- 展示 failure_type、failure_reason、retry_count、next_recommendation。
- 计算受影响下游任务。
- 输出可用于 UI 的 failure summary。

## 验收标准

- failed task 能展示失败原因。
- blocked task 能展示 blocked_reason。
- retry_count 能展示。
- 下游影响范围可追踪。

## 关联代码

- `src/scheduler/dependency_resolver.ts`
- `src/execution/result_collector.ts`
- `src/visualization/*`
- `tests/visualization.test.ts`

