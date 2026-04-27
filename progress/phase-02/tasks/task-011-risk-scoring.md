# T011 Risk Scoring

## 状态

`done`

## 完成记录

- 新增 `risk_scorer.ts`。
- 实现 `scoreTaskRisk(...)`。
- 风险评分包含显式 risk、expected files、missing expected files、retry count、missing preferred agent。
- Scheduler 在 `risk_aware` 或 `prefer_low_risk_first` policy 下按低风险优先排序。
- 高风险并发限制改为读取 `execution_policy.risk.high_risk_parallel_limit`。
- Scheduler 输出 `risk_scores`。
- 补充风险评分、风险排序和高风险并发策略测试。

## 验证

```txt
npm run typecheck
npm run build
npm test
```

全部通过。

## 目标

将任务的 `risk` 从静态枚举升级为可解释的风险评分，帮助 Scheduler 决定任务排序、并发限制和 ReviewGate 严格程度。

## 范围

- 新增风险评分函数。
- 基于任务字段计算 score：
  - 显式 `risk`
  - `expected_files` 数量
  - 是否包含共享目录或核心路径
  - 是否缺少 `expected_files`
  - 是否需要 preferred agent
  - 是否有历史失败或 retry
- Scheduler 使用 score 影响 wave 选择。
- ReviewGate 对 critical score 任务输出更明确的 review requirement。

## 验收标准

- 风险评分有单元测试。
- 同等 ready 条件下，低风险任务可优先进入 wave。
- 高风险任务不超过 policy 限制。
- critical 任务必须触发 review 说明。
- skipped reason 包含风险评分原因。

## 关联代码

- `src/scheduler/scheduler.ts`
- `src/models/task.ts`
- `src/execution/review_gate.ts`
- `tests/scheduler.test.ts`
