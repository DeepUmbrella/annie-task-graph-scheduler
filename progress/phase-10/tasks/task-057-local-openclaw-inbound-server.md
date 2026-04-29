# T057 Local OpenClaw Inbound Server

## 状态

`done`

## 目标

提供最小本地 HTTP 入口，让 OpenClaw/Annie 消息能进入 TaskGraphScheduler。

## 范围

- 新增 `src/server/inbound_server.ts`。
- 新增 CLI `serve [--host <host>] [--port <port>]`。
- 新增 npm script `serve`。
- 接收 `POST /openclaw/messages` 和 `/annie/messages`。
- 健康检查 `GET /health`。
- 终端打印 `[annie-tgs:inbound]` log。
- 写入 `.annie/inbound/openclaw-messages.jsonl`。

## 完成记录

- 已实现本地 inbound server。
- 已实现 JSON body 解析、1MB body limit 和 JSON 错误。
- 已实现 inbound JSONL 持久化。
- 已补充 `docs/local_openclaw_inbound_smoke_test.md`。

## 验证结果

```txt
npm run typecheck: pass
npm run build: pass
npm test: 124 passed
```

## 关联代码

- `src/server/inbound_server.ts`
- `src/cli.ts`
- `package.json`
- `tests/inbound_server.test.ts`
- `docs/local_openclaw_inbound_smoke_test.md`
