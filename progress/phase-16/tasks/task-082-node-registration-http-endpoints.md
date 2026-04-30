# T082 Node Registration HTTP Endpoints

## 状态

`todo`

## 目标

提供 runtime-neutral node registration endpoints。

## 范围

- 新增 `POST /nodes/register`。
- 新增 `GET /nodes`。
- response 返回 registered node / team counts。

## 验收标准

- `POST /nodes/register` 可以注册 proposal。
- `GET /nodes` 返回 registry snapshot。
- endpoints 不带 runtime 名称。

## 关联代码

- `src/server/inbound_server.ts`
- `tests/inbound_server.test.ts`
