# T014 Scheduler Policy Integration

## 状态

`done`

## 完成记录

- 新增 `WaveDecision`。
- Scheduler 输出 `decision`。
- `decision` 包含 selected tasks、skipped tasks、policy applied、risk summary、agent load summary、conflict summary。
- skipped task 增加 category。
- wave reason 包含策略摘要。
- 保持原有 `wave` 和 `skipped_ready_tasks` 兼容输出。
- 补充结构化决策输出测试。

## 验证

```txt
npm run typecheck
npm run build
npm test
```

全部通过。

## 目标

将 Agent 负载、风险评分、重试状态和增强冲突预测接入 Scheduler，形成 Phase 02 的完整调度决策链。

## 范围

- Scheduler 读取 Phase 02 policy。
- ready task 排序支持策略。
- wave 选择支持负载和风险约束。
- skipped ready task reason 更结构化。
- wave reason 包含关键策略决策。
- Scheduler 输出可用于 CLI/status 展示。

## 建议输出

```txt
WaveDecision
├── selected_tasks
├── skipped_tasks
├── policy_applied
├── risk_summary
├── agent_load_summary
└── conflict_summary
```

## 验收标准

- Scheduler 输出不只是 task ids，也包含解释。
- 负载、风险、冲突、并发上限都能在 skipped reason 中体现。
- Phase 01 wave 结果在默认 policy 下不改变。
- Phase 02 policy 开启后可观察到不同排序或跳过原因。

## 关联代码

- `src/scheduler/scheduler.ts`
- `src/scheduler/conflict_detector.ts`
- `src/execution/worker_pool.ts`
- `tests/scheduler.test.ts`
