# Phase 21 Plan: Autonomous Workflow Bootstrap

## 背景

Phase 20 已能接收并保存经过 DAG validation 的 plan proposal。下一步需要显式把某个 proposal bootstrap 成 workflow state。

关键产品规则：

```txt
Proposal intake does not start execution.
Bootstrap is the explicit boundary that creates workflow state.
Scheduling still requires next-wave / orchestration step.
```

## 目标

实现最小 Workflow Bootstrap：

- 从 proposal id 查找 valid plan proposal。
- 创建 workflow state。
- 保存 state。
- 记录 bootstrap audit event。
- 提供 runtime-neutral endpoint。

## 边界

本阶段做：

- 新增 `src/workflow_bootstrap/*`。
- 支持 `bootstrapWorkflowFromProposal`。
- 新增 `POST /workflow-bootstrap`。
- 支持指定或自动生成 workflow id。

本阶段不做：

- 不自动 next-wave。
- 不自动 dispatch。
- 不调用 OpenClaw。
- 不做 UI 审批。

## Task 列表

### T105 Workflow bootstrap model

- 定义 bootstrap input / result。
- 定义 workflow id 生成规则。

### T106 Bootstrap from proposal

- 从 proposal store 加载 proposal。
- 使用 `createInitialWorkflowState` 创建 state。
- 保存 state。
- 写 audit event。

### T107 Bootstrap endpoint

- 新增 `POST /workflow-bootstrap`。
- `serve` 输出 endpoint。

### T108 Bootstrap tests

- 覆盖 bootstrap 创建 state。
- 覆盖 missing proposal。
- 覆盖 bootstrap 不自动生成 wave。

### T109 Phase 21 acceptance

- 更新 PRD implementation status。
- 更新 progress README 和 agent handoff 状态。
- 跑通 `npm run typecheck`、`npm run build`、`npm test`。

## 验收标准

1. 已保存 proposal 可 bootstrap 成 workflow state。
2. workflow id 可指定。
3. missing proposal 返回结构化错误。
4. bootstrap 后 workflow `status` 为 `pending`。
5. bootstrap 不自动创建 wave。
6. Phase 01-20 回归测试继续通过。
