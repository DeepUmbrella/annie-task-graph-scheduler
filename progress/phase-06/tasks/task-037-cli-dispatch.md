# T037 CLI Dispatch

## 状态

`done`

## 目标

实现 `dispatch --workflow <workflow_id> --wave <wave_id>`，将 wave 任务分配给 worker 并持久化 assignment。

## 范围

- 扩展 `src/cli.ts`。
- 加载 workflow state。
- 查找指定 wave。
- 调用 `assignWorkers`。
- 保存 next state。
- 追加 assignment audit events。
- 输出 assignments JSON。

## 验收标准

- ready task 被更新为 running。
- wave 被更新为 running。
- assignment 写入 state。
- audit log 包含 worker assignment 和 task status change。
- 指定不存在 wave 时返回结构化错误。

## 关联代码

- `src/cli.ts`
- `src/execution/worker_pool.ts`
- `src/storage/state_store.ts`
- `tests/e2e_execution_cli.test.ts`

## 完成记录

- 新增 `dispatch --workflow <workflow_id> --wave <wave_id>` CLI。
- 命令会查找指定 wave 并调用 `assignWorkers`。
- 保存 worker assignment 后的 workflow state。
- 追加 WORKER_ASSIGNED 和 TASK_STATUS_CHANGED audit events。
- CLI 输出 assignments、audit event 数量和 state summary。
- 扩展 execution CLI e2e，覆盖 dispatch state 持久化和 audit log。

## 验证结果

```txt
npm run typecheck
npm run build
npm test
94 passed
```
