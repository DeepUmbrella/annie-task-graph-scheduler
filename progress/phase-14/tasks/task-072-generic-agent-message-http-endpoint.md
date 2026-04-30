# T072 Generic Agent Message HTTP Endpoint

## 状态

`todo`

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
