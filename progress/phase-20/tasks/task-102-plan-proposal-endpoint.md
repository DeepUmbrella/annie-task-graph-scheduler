# T102 Plan Proposal Endpoint

## 状态

`done`

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

## 实施记录

- 新增 `POST /plan-proposals`。
- 新增 `GET /plan-proposals`。
- 新增 `receivePlanProposal` helper。
- 新增 `listPlanProposals` helper。
- `serve` 输出新增 `plan_proposals` endpoint 和 `plan_proposals_path`。

## 验证

- `npm run typecheck` passed.
- `npm run build` passed.
- `node --test dist/tests/inbound_server.test.js` passed.
- `node --test dist/tests/plan_proposal.test.js` passed.
