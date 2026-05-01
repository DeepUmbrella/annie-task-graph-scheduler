# T121 Dispatch Tests

## 状态

`todo`

## 目标

覆盖 Wave Task Dispatch 的 service、endpoint、CLI 行为。

## 范围

- Dispatch service 测试。
- Endpoint intake 测试。
- CLI 测试。
- 回归确保 dispatch 不调用 OpenClaw、不进入 running。

## 验收标准

- Successful dispatch 测试通过。
- Ineligible node rejection 测试通过。
- Retry idempotency 测试通过。
- Endpoint 和 CLI 测试通过。

## 关联代码

- `tests/workflow_dispatch.test.ts`
- `tests/inbound_server.test.ts`
- `tests/e2e_execution_cli.test.ts`
