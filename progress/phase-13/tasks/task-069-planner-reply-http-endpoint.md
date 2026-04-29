# T069 Planner Reply HTTP Endpoint

## 状态

`done`

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

## 完成记录

- 新增 `POST /openclaw/planner-replies`。
- endpoint 会把 planner reply 转成 `REQUIREMENT_CLARIFICATION_REQUEST`。
- response 返回 clarification message id、delivery status、问题数量和 Annie inbox path。
- CLI startup metadata 增加 planner reply endpoint。
- smoke-test 文档已补充 planner reply 回写步骤。

## 验证结果

```txt
npm run typecheck: pass
npm run build: pass
node --test dist/tests/inbound_server.test.js: 3 passed
node --test dist/tests/planner_reply_intake.test.js: 4 passed
```
