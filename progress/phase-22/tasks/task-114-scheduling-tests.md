# T114 Scheduling Tests

## 状态

`todo`

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
