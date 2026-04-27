# T049 Scheduler State-change Audit Coverage

## 状态

`todo`

## 目标

补齐 CLI `next-wave` 中由 dependency resolver 产生的任务状态变化 audit log。

## 范围

- 扩展 `src/cli.ts`。
- 在 `next-wave` 持久化 state 后，为 `status_changes` 追加 audit events。
- 覆盖 ready / blocked 等 scheduler-driven 状态变化。
- 增加 CLI e2e 测试。

## 验收标准

- `next-wave` 将 `pending -> ready` 写入 audit log。
- 上游失败导致的 blocked 状态变化写入 audit log。
- 现有 `next-wave` JSON 输出保持兼容。
- Phase 01-07 回归测试继续通过。

## 关联代码

- `src/cli.ts`
- `tests/e2e_execution_cli.test.ts`
