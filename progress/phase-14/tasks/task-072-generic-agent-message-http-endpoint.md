# T072 Generic Agent Message HTTP Endpoint

## 状态

`done`

## 目标

新增通用 agent message HTTP endpoint，并让旧 planner reply endpoint 复用同一实现。

## 范围

- 扩展 `src/server/inbound_server.ts`。
- 新增 `POST /openclaw/agent-messages`。
- 保留 `POST /openclaw/planner-replies`。
- 更新 server 测试。

## 验收标准

- 新 endpoint 可接收 agent message。
- 旧 endpoint 继续通过。
- 两个 endpoint 都写入 Annie inbox。

## 关联代码

- `src/server/inbound_server.ts`
- `tests/inbound_server.test.ts`

## 完成记录

- 新增 `receiveAgentMessage`。
- 新增 `POST /openclaw/agent-messages` 通用 endpoint。
- `POST /openclaw/planner-replies` 保持兼容 alias。
- response 增加通用字段：`agent_message_id`、`message_type`、`classification`、`inbox_path`。
- 旧 clarification response 字段继续保留。

## 验证结果

```txt
npm run typecheck: pass
npm run build: pass
node --test dist/tests/inbound_server.test.js: 4 passed
```
