# Phase 24 Plan: Agent Result Intake

## 背景

Phase 23 已能将 scheduled wave task 分发到 registered node inbox，并把 task 标记为 `assigned`。下一步需要提供 runtime-neutral result intake，让执行节点提交结构化结果，并进入 review flow。

关键产品规则：

```txt
Dispatch assigns work.
Result intake validates sender and assignment.
Result intake may implicitly acknowledge assigned work.
ResultCollector owns task result state transitions.
ReviewGate is a later explicit phase.
```

## 目标

实现最小 Agent Result Intake：

- 解析 runtime-neutral task result payload。
- 校验 sender node、task assignment、workflow/wave/task 关系。
- 支持从 `assigned` 或 `running` 接收结果。
- 复用 ResultCollector 将 completed task 推进到 `reviewing`，failed task 按 retry policy 处理。
- 保存 state，写 audit。
- 提供 endpoint 和 CLI。

## 边界

本阶段做：

- 新增 result intake model / service。
- 支持 assigned task 的隐式 start/ack。
- 支持 endpoint 和 CLI。
- 持久化原始 submitted result payload 到 audit。

本阶段不做：

- 不自动 ReviewGate。
- 不自动 schedule next wave。
- 不调用 OpenClaw callback。
- 不做 dynamic replanning。

## Task 列表

### T123 Result intake model

- 定义 result intake input / result / decision model。
- 定义 sender / task / wave 字段。

### T124 Result intake service

- 加载 workflow state。
- 校验 sender 是 task assigned node。
- 支持 assigned -> running 的隐式过渡。
- 调用 ResultCollector。
- 保存 state 和 audit events。

### T125 Result intake endpoint

- 新增 runtime-neutral result intake endpoint。
- 返回结构化 intake result。
- `serve` 输出 endpoint。

### T126 Result intake CLI

- 新增 CLI command。
- 支持 result JSON file。
- 与 endpoint 复用同一 service。

### T127 Result intake tests

- 覆盖 completed result。
- 覆盖 failed retry。
- 覆盖 unauthorized sender rejection。
- 覆盖 endpoint 和 CLI。

### T128 Phase 24 acceptance

- 更新 PRD implementation status。
- 更新 progress README 和 agent handoff 状态。
- 跑通 `npm run typecheck`、`npm run build`、`npm test`。

## 验收标准

1. Assigned task 可通过 result intake 进入 `reviewing`。
2. Failed result 遵循 retry policy。
3. 非 assigned node 不能提交结果。
4. Endpoint 和 CLI 都可用。
5. Result intake 不自动 review、不自动 next-wave。
6. Phase 01-23 回归测试继续通过。
