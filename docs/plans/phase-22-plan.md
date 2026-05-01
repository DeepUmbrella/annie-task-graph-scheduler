# Phase 22 Plan: Workflow Scheduling Loop

## 背景

Phase 21 已能把 validated plan proposal 显式 bootstrap 成 workflow state。下一步需要从 workflow state 显式生成下一波可执行任务，为后续 dispatch / result / review 闭环打基础。

关键产品规则：

```txt
Bootstrap creates workflow state.
Scheduling creates a wave.
Dispatch is a later explicit phase.
```

## 目标

实现最小 Workflow Scheduling Loop：

- 通过 `workflow_id` 加载 workflow state。
- 复用现有 scheduler 生成下一波 wave。
- 保存更新后的 workflow state。
- 记录 scheduling audit event。
- 返回结构化 scheduling decision。
- 同时提供 endpoint 和 CLI。

## 边界

本阶段做：

- 新增 autonomous workflow scheduling service。
- 支持 next-wave 显式推进。
- 支持 no-ready-task / completed / active-wave 等结构化结果。
- 新增 runtime-neutral endpoint。
- 新增 CLI command。

本阶段不做：

- 不 dispatch 任务到 agent。
- 不调用 OpenClaw。
- 不收 task result。
- 不跑 daemon / polling loop。
- 不做 dynamic replanning。

## Task 列表

### T110 Workflow scheduling model

- 定义 next-wave input / result / decision model。
- 定义 scheduling decision reason。

### T111 Schedule next wave service

- 从 StateStore 加载 workflow state。
- 调用现有 scheduler 生成下一波。
- 处理 active-wave / no-ready-task / completed 等状态。
- 保存 state 并写 audit event。

### T112 Next-wave endpoint

- 新增 runtime-neutral endpoint。
- 返回结构化 scheduling result。
- `serve` 输出 endpoint。

### T113 Next-wave CLI

- 新增 CLI command。
- 支持 JSON 输出。
- 与 endpoint 使用同一 service。

### T114 Scheduling tests

- 覆盖 bootstrapped workflow 生成 first wave。
- 覆盖 active wave idempotency。
- 覆盖 no-ready-task / completed workflow。
- 覆盖 endpoint 和 CLI。

### T115 Phase 22 acceptance

- 更新 PRD implementation status。
- 更新 progress README 和 agent handoff 状态。
- 跑通 `npm run typecheck`、`npm run build`、`npm test`。

## 验收标准

1. 已 bootstrap 的 workflow 可显式生成 first wave。
2. 已存在 active wave 时不会重复生成 wave。
3. 没有 ready task 时返回结构化 no-ready decision。
4. 已完成 workflow 返回 completed decision。
5. endpoint 和 CLI 都可用。
6. scheduling 不 dispatch、不调用 OpenClaw。
7. Phase 01-21 回归测试继续通过。
