# T007 Recovery And E2E

## 状态

`todo`

## 目标

完成 M6：恢复与端到端验收。

## 范围

- 实现 RecoveryManager。
- 实现 `recover` CLI。
- 跑通完整 MVP e2e fixture。
- 覆盖任务失败、文件冲突和中断恢复场景。

## 验收标准

- 已完成任务恢复后不会重复执行。
- `reviewing` 任务恢复后重新进入 ReviewGate。
- `running` 且 session 丢失的任务被明确处理。
- T1 -> T2/T3/T5 -> T4 -> T6 样例可生成正确 wave 序列。
- T3 失败后 T4 被阻塞。

## 关联代码

- `src/storage/recovery_manager.ts`
- `src/cli.ts`
- `tests/e2e_mvp_flow.test.ts`

