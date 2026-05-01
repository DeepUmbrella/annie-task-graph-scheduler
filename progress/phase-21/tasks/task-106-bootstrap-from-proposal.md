# T106 Bootstrap From Proposal

## 状态

`todo`

## 目标

从 plan proposal 创建 workflow state。

## 范围

- 加载 plan proposal。
- 创建 initial workflow state。
- 保存 state。
- 写 audit event。

## 验收标准

- state 文件被创建。
- audit 记录 bootstrap 事件。
- missing proposal 返回结构化错误。

## 关联代码

- `src/workflow_bootstrap/bootstrap.ts`
- `tests/workflow_bootstrap.test.ts`
