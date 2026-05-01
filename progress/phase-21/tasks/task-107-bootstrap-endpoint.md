# T107 Bootstrap Endpoint

## 状态

`done`

## 目标

提供 workflow bootstrap endpoint。

## 范围

- 新增 `POST /workflow-bootstrap`。
- `serve` 输出 endpoint。
- endpoint runtime-neutral。

## 验收标准

- POST 可从 proposal bootstrap workflow。
- response 返回 workflow id 和 state path。

## 关联代码

- `src/server/inbound_server.ts`
- `src/cli.ts`
- `tests/inbound_server.test.ts`

## 实施记录

- 新增 `POST /workflow-bootstrap`。
- 新增 `receiveWorkflowBootstrap` helper。
- `serve` 输出新增 `workflow_bootstrap` endpoint。
- response 返回 workflow id、state path、audit path。

## 验证

- `npm run typecheck` passed.
- `npm run build` passed.
- `node --test dist/tests/inbound_server.test.js` passed.
- `node --test dist/tests/workflow_bootstrap.test.js` passed.
