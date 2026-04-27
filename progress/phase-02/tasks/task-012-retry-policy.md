# T012 Retry Policy

## 状态

`done`

## 完成记录

- 新增 `retry_policy.ts`。
- 实现 `decideRetry(...)`。
- ResultCollector 根据 `failure_type` 和 `execution_policy.retry` 判断自动重试。
- retryable 失败自动回到 `ready`。
- retry 会增加 `retry_count`，清空 assignment 并生成 `TASK_RETRY_SCHEDULED`。
- 超过 retry limit 或非 retryable 失败保持 `failed` 并生成 `TASK_RETRY_SKIPPED`。
- 补充 retry 单元测试。

## 验证

```txt
npm run typecheck
npm run build
npm test
```

全部通过。

## 目标

将失败处理从基础状态流转升级为可配置自动重试策略。

## 范围

- 扩展 retry policy。
- 根据 `failure_type` 判断是否自动重试。
- 支持最大重试次数。
- 支持 retry audit event。
- 支持第二次失败后进入 manual review。
- ResultCollector 或 FailureHandler 根据策略将任务转回 `ready` 或保持 `failed`。
- 下游 blocked 传播与 retry 状态协调。

## 验收标准

- `transient` 失败在次数允许时自动回到 `ready`。
- `implementation` 失败不自动重试。
- 超过 `max_retries` 后不再自动重试。
- retry 会增加 `retry_count`。
- retry / no-retry 原因写入 audit 或解释输出。

## 关联代码

- `src/execution/result_collector.ts`
- `src/scheduler/dependency_resolver.ts`
- `src/storage/state_store.ts`
- `tests/execution.test.ts`
