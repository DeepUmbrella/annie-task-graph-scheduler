# T118 Dispatch Mailbox Delivery

## 状态

`done`

## 目标

将 selected task assignment 写入 node inbox，并将 task 标记为 `assigned`。

## 范围

- 创建 `TASK_ASSIGNED` mailbox message。
- 保存 state。
- 写 audit event。
- 支持 retry idempotency。

## 验收标准

- Assignment message 写入目标 node inbox。
- Task 状态为 `assigned`。
- 重复 dispatch 不重复创建 assignment message。

## 关联代码

- `src/workflow_dispatch/dispatch_wave.ts`
- `src/communication/mailbox_store.ts`
- `src/storage/state_store.ts`

## 完成记录

- 新增 `dispatchWorkflowWave` service。
- 通过 MessageBus 创建 `TASK_ASSIGNED` message。
- 写入 orchestrator outbox 和 target node inbox。
- 将 task 从 `ready` 标记为 `assigned`，不进入 `running`。
- 写 dispatch / status / decision audit events。
- 支持 already assigned idempotency。
- ReviewGate 将 `assigned` 视为 incomplete task。

## 验证结果

```txt
npm run typecheck: pass
```
