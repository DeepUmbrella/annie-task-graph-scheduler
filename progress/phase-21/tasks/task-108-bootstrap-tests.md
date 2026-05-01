# T108 Bootstrap Tests

## 状态

`done`

## 目标

补齐 workflow bootstrap 行为测试。

## 范围

- 创建 state。
- missing proposal。
- 不自动创建 wave。

## 验收标准

- workflow bootstrap tests 通过。
- inbound helper tests 通过。

## 关联代码

- `tests/workflow_bootstrap.test.ts`
- `tests/inbound_server.test.ts`

## 实施记录

- 覆盖 bootstrap 创建 workflow state。
- 覆盖 missing proposal。
- 覆盖 bootstrap 不自动创建 wave。
- 覆盖 inbound bootstrap helper。

## 验证

- `npm run typecheck` passed.
- `npm run build` passed.
- `node --test dist/tests/workflow_bootstrap.test.js` passed.
- `node --test dist/tests/inbound_server.test.js` passed.
