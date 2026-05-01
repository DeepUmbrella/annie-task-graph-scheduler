# T101 Plan Proposal Store

## 状态

`todo`

## 目标

实现 plan proposal 本地持久化。

## 范围

- 使用 `.annie/plans/proposals.json`。
- 支持保存 proposal。
- 支持读取 proposal list。

## 验收标准

- 文件不存在时返回空列表。
- 保存后可读取。
- 保存 proposal 不创建 workflow state。

## 关联代码

- `src/plan_proposal/store.ts`
- `tests/plan_proposal.test.ts`
