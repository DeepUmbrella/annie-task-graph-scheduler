# T103 Plan Proposal Intake Tests

## 状态

`done`

## 目标

补齐 plan proposal intake 行为测试。

## 范围

- valid proposal。
- invalid DAG。
- fenced JSON。
- 不创建 workflow state。

## 验收标准

- plan proposal 相关测试通过。
- 旧 workflow init 行为不受影响。

## 关联代码

- `tests/plan_proposal.test.ts`
- `tests/inbound_server.test.ts`

## 实施记录

- 覆盖 valid proposal。
- 覆盖 invalid DAG。
- 覆盖 fenced JSON。
- 覆盖 proposal 持久化。
- 覆盖 proposal intake 不创建 workflow state。

## 验证

- `npm run typecheck` passed.
- `npm run build` passed.
- `node --test dist/tests/plan_proposal.test.js` passed.
- `node --test dist/tests/inbound_server.test.js` passed.
