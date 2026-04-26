# T004 Wave Scheduling And Conflict Detection

## 状态

`done`

## 完成记录

- 实现 `detectFileConflicts(...)`。
- 实现 `hasFileConflict(...)`。
- 实现 `generateNextWave(...)`。
- 支持 `max_parallel_tasks`。
- 支持 `max_agents`。
- 支持 `can_parallel=false` 串行约束。
- 支持同文件 `expected_files` 冲突串行化。
- 支持高风险任务串行化。
- 输出 skipped ready task reason。

## 验证

```txt
npm run typecheck
npm run build
npm test
```

全部通过。

## 目标

完成 M3：Wave 调度。

## 范围

- 实现 ConflictDetector。
- 实现 Scheduler。
- 支持 `max_parallel_tasks`。
- 支持 `max_agents`。
- 支持 `same_file_conflict_policy = "serialize"`。
- 支持高风险任务并发限制。
- 输出 skipped ready task reason。

## 验收标准

- 独立任务可以进入同一 wave。
- 依赖未满足任务不会进入 wave。
- 文件冲突任务不会进入同一 wave。
- 高风险任务默认不与其他高风险任务并发。
- wave 大小不超过 `max_parallel_tasks`。
- wave 使用 Agent 数不超过 `max_agents`。
- 被跳过的 ready task 有明确原因。

## 关联代码

- `src/scheduler/conflict_detector.ts`
- `src/scheduler/scheduler.ts`
- `tests/scheduler.test.ts`
