# T009 Scheduling Policy Model

## 状态

`done`

## 完成记录

- 扩展 `ExecutionPolicy`。
- 新增 `SchedulingPolicy`、`AgentPolicy`、`RiskPolicy`、`RetryPolicy`、`ConflictPolicy`。
- 新增 `ExecutionPolicyInput` 支持嵌套局部配置。
- 更新 `defaultExecutionPolicy`。
- 实现 `normalizeExecutionPolicy(...)` 深度合并默认值。
- 补充 Phase 02 policy fixture。
- 补充 policy 默认值与深度合并测试。

## 验证

```txt
npm run typecheck
npm run build
npm test
```

全部通过。

## 目标

为 Phase 02 增强调度建立统一策略模型，让后续 Agent 负载、风险评分、重试和冲突预测都能通过 Execution Policy 配置，而不是散落在各模块里。

## 背景

Phase 01 的 `ExecutionPolicy` 已包含：

- `max_parallel_tasks`
- `max_agents`
- `same_file_conflict_policy`
- `review_after_each_wave`
- `stop_on_critical_failure`
- `max_retries`
- ACK 与投递重试配置

Phase 02 需要扩展为更完整的调度策略层。

## 范围

- 扩展 `ExecutionPolicy` 类型。
- 增加 `SchedulingPolicy` 子结构。
- 增加 `AgentPolicy` 子结构。
- 增加 `RiskPolicy` 子结构。
- 增加 `RetryPolicy` 子结构。
- 增加 `ConflictPolicy` 子结构。
- 更新 `defaultExecutionPolicy`。
- 更新 plan loader 默认值合并逻辑。
- 补充 policy fixture 和单元测试。

## 建议模型

```txt
execution_policy
├── scheduling
│   ├── selection_order
│   ├── prefer_low_risk_first
│   └── explain_skipped_tasks
├── agents
│   ├── max_tasks_per_agent
│   ├── respect_preferred_agent
│   └── fallback_agent
├── risk
│   ├── high_risk_parallel_limit
│   ├── critical_requires_review
│   └── scoring_weights
├── retry
│   ├── max_retries
│   ├── retry_on
│   └── backoff
└── conflicts
    ├── mode
    ├── directory_conflict_depth
    └── unknown_files_policy
```

## 验收标准

- 旧 plan 不需要改动也能继续通过。
- 新 policy 字段有默认值。
- 非法 policy 字段能被校验或安全忽略。
- Phase 01 e2e 不受影响。

## 关联代码

- `src/models/plan.ts`
- `src/validation/plan_loader.ts`
- `tests/dag_validator.test.ts`
- `tests/fixtures/*`
