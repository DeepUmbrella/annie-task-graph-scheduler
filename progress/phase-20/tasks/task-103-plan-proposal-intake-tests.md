# T103 Plan Proposal Intake Tests

## 状态

`todo`

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
