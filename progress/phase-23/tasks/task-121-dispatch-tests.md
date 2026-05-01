# T121 Dispatch Tests

## 状态

`done`

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

## 完成记录

- 新增 `tests/workflow_dispatch.test.ts`。
- 覆盖 successful dispatch 到 node inbox。
- 覆盖 retry idempotency。
- 覆盖 no eligible node rejection。
- 更新 inbound server 测试覆盖 `receiveWorkflowDispatch`。
- 更新 CLI e2e 测试覆盖 `workflow-dispatch`。
- 验证 dispatch 后 task 为 `assigned`，不是 `running`。

## 验证结果

```txt
npm run typecheck: pass
npm run build: pass
node --test dist/tests/workflow_dispatch.test.js: 3 passed
node --test dist/tests/inbound_server.test.js: 10 passed
node --test dist/tests/e2e_execution_cli.test.js: 10 passed
```
