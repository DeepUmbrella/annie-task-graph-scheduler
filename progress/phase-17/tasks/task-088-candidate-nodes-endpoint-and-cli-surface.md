# T088 Candidate Nodes Endpoint And CLI Surface

## 状态

`todo`

## 目标

提供 candidate nodes 的读取和触发入口。

## 范围

- 新增 `GET /nodes/candidates`。
- `serve` 输出 candidates endpoint。
- 可选新增 CLI discovery 命令。

## 验收标准

- endpoint 返回 discovery snapshot。
- endpoint 不包含 runtime-specific route name。
- serve 输出包含 candidates endpoint。

## 关联代码

- `src/server/inbound_server.ts`
- `src/cli.ts`
- `tests/inbound_server.test.ts`
