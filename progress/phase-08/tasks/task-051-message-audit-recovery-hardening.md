# T051 Message Audit And Recovery Hardening

## 状态

`todo`

## 目标

强化 MessageBus / MailboxStore 的关键消息持久化、ACK、processed、failed 行为测试，并明确其与任务状态 audit log 的边界。

## 范围

- 补充 `tests/message_bus.test.ts`。
- 覆盖 mailbox JSONL 恢复读取关键消息状态。
- 确认 ACK / processed / failed 消息均可从 mailbox 读取。
- 不允许消息直接修改 workflow task state。

## 验收标准

- 关键消息状态持久化可恢复。
- failed delivery 可恢复读取。
- MessageBus 不绕过 StateStore 修改任务状态。
- Phase 01-07 回归测试继续通过。

## 关联代码

- `src/communication/message_bus.ts`
- `src/communication/mailbox_store.ts`
- `tests/message_bus.test.ts`
