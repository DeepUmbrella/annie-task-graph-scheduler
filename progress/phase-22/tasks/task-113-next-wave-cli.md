# T113 Next-Wave CLI

## 状态

`done`

## 目标

提供 CLI command 执行 next-wave scheduling。

## 范围

- 新增 CLI command。
- 支持 workflow id。
- 支持 JSON 输出。
- 与 endpoint 复用同一 service。

## 验收标准

- CLI 可 schedule workflow。
- CLI structured JSON error 与既有风格一致。
- CLI 不 dispatch。

## 关联代码

- `src/cli.ts`
- `src/workflow_scheduling/schedule_next_wave.ts`

## 完成记录

- 复用现有 `next-wave` CLI command。
- CLI 改为调用 `scheduleNextWorkflowWave`。
- 保留 `ready_task_ids`、`blocked_task_ids`、`status_changes`、`wave` 等既有输出字段。
- 新增 scheduling decision、state path、audit path 输出。

## 验证结果

```txt
npm run typecheck: pass
npm run build: pass
node --test dist/tests/e2e_execution_cli.test.js: pending test update in T114 because Phase 22 adds scheduling audit events
```
