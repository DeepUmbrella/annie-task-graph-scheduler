# T082 Node Registration HTTP Endpoints

## 状态

`done`

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

## 实施记录

- 新增 `POST /nodes/register`。
- 新增 `GET /nodes`。
- 新增 `receiveNodeRegistration` helper。
- 新增 `listRegisteredNodes` helper。
- `serve` 输出新增 `nodes_register`、`nodes` 和 `node_registry_path`。
- endpoint 命名保持 runtime-neutral，不包含 OpenClaw。

## 验证

- `npm run typecheck` passed.
- `npm run build` passed.
- `node --test dist/tests/inbound_server.test.js` passed.

## 备注

当前沙箱禁止测试进程监听 `127.0.0.1`，因此没有在自动测试中启动真实 HTTP server；路由已在 `startInboundServer` 中接入，测试覆盖路由背后的注册和读取边界。
