# T118 Dispatch Mailbox Delivery

## 状态

`todo`

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
