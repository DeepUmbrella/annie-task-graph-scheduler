# T102 Plan Proposal Endpoint

## 状态

`todo`

## 目标

提供 runtime-neutral plan proposal endpoints。

## 范围

- 新增 `POST /plan-proposals`。
- 新增 `GET /plan-proposals`。
- `serve` 输出 endpoint。

## 验收标准

- POST 可保存 proposal。
- GET 可读取 proposal list。
- endpoint 不包含 runtime 名称。

## 关联代码

- `src/server/inbound_server.ts`
- `src/cli.ts`
- `tests/inbound_server.test.ts`
