# T069 Planner Reply HTTP Endpoint

## 状态

`todo`

## 目标

提供 HTTP endpoint 接收真实 OpenClaw planner reply。

## 范围

- 扩展 `src/server/inbound_server.ts`。
- 新增 `POST /openclaw/planner-replies`。
- response 返回 clarification message metadata。
- 更新 smoke-test 文档。

## 验收标准

- endpoint 可以接收 planner reply payload。
- response 包含 `clarification_message_id` 和 Annie inbox path。
- 终端可观察 `[annie-tgs:planner-reply]` log。

## 关联代码

- `src/server/inbound_server.ts`
- `tests/inbound_server.test.ts`
- `docs/local_openclaw_inbound_smoke_test.md`
