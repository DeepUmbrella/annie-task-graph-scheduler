# T006 MessageBus And Mailbox

## 状态

`todo`

## 目标

完成 M5：MessageBus 与 Mailbox。

## 范围

- 实现 MessageBus。
- 实现本地 JSONL MailboxStore。
- 实现 ProtocolValidator。
- 支持核心消息类型。
- 支持 ACK、投递重试和消息状态更新。
- 接入 MockAdapter。

## 验收标准

- `TASK_ASSIGNED` 可写入 agent inbox。
- `TASK_COMPLETED` 可写入 orchestrator inbox。
- 不合法消息方向被拒绝。
- 任务相关消息必须包含 `workflow_id`、`task_id`、`wave_id`。
- ACK 超时后最多重试 2 次。
- 消息状态从 `created` 推进到 `processed` 或 `failed`。

## 关联代码

- `src/communication/message_bus.ts`
- `src/communication/mailbox_store.ts`
- `src/communication/protocol_validator.ts`
- `src/communication/openclaw_adapter.ts`
- `tests/message_bus.test.ts`

