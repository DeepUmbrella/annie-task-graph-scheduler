# T058 Inbound Message To Workflow Intent

## 状态

`done`

## 目标

收到 OpenClaw/Annie 消息后，创建本地 workflow intent，作为后续 planner/team controller 的输入。

## 范围

- 新增 `src/intake/intent.ts`。
- 从 inbound payload 提取 `goal` / `message` / `text`。
- 创建 `intent_id`。
- 写入 `.annie/intents/<intent_id>.json`。
- inbound endpoint 响应中返回 `intent_id` / `intent_path`。
- 终端打印 `[annie-tgs:intent]` log。

## 完成记录

- 已实现 `WorkflowIntent` 模型。
- 已实现 `createWorkflowIntentFromInboundPayload`。
- inbound server 已串联 message persistence 和 intent creation。
- 文档已更新 intent 日志和 intent 文件位置。

## 验证结果

```txt
npm run typecheck: pass
npm run build: pass
npm test: 126 passed
```

## 关联代码

- `src/intake/intent.ts`
- `src/intake/index.ts`
- `src/server/inbound_server.ts`
- `tests/intent.test.ts`
- `tests/inbound_server.test.ts`
- `docs/local_openclaw_inbound_smoke_test.md`
