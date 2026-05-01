# T114 Scheduling Tests

## 状态

`done`

## 目标

覆盖 Workflow Scheduling Loop 的 service、endpoint、CLI 行为。

## 范围

- service 单元测试。
- endpoint intake 测试。
- CLI 测试。
- 回归确保 scheduling 不 dispatch。

## 验收标准

- first wave scheduling 测试通过。
- active wave idempotency 测试通过。
- no-ready / completed decision 测试通过。
- endpoint 和 CLI 测试通过。

## 关联代码

- `tests/workflow_scheduling.test.ts`
- `tests/inbound_server.test.ts`
- `tests/cli.test.ts`

## 完成记录

- 新增 `tests/workflow_scheduling.test.ts`。
- 覆盖 first wave scheduling 不 dispatch。
- 覆盖 active wave idempotency。
- 覆盖 no-ready / completed decision。
- 更新 inbound server 测试覆盖 `receiveWorkflowNextWave`。
- 更新 CLI e2e 测试以兼容 scheduling audit event。

## 验证结果

```txt
npm run typecheck: pass
npm run build: pass
node --test dist/tests/workflow_scheduling.test.js: 4 passed
node --test dist/tests/inbound_server.test.js: 9 passed
node --test dist/tests/e2e_execution_cli.test.js: 9 passed
```
