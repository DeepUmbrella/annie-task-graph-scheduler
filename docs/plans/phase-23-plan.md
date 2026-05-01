# Phase 23 Plan: Wave Task Dispatch

## 背景

Phase 22 已能从 bootstrapped workflow 显式生成 active wave。下一步需要把 wave 中的 ready tasks 分发到已注册节点的 mailbox，但不直接调用 OpenClaw transport。

关键产品规则：

```txt
Scheduling creates a pending wave.
Dispatch creates task assignment messages.
Dispatch does not call OpenClaw.
Tasks become assigned first.
Tasks become running only after acknowledgement in a later phase.
```

## 目标

实现最小 Wave Task Dispatch：

- 加载 workflow 当前 active wave。
- 根据 task capability / preferred_agent 选择 registered node。
- 校验节点权限和 team membership。
- 写入 `TASK_ASSIGNED` mailbox message。
- 将 task 标记为 `assigned`。
- 记录 dispatch audit event。
- 提供 endpoint 和 CLI。

## 边界

本阶段做：

- 新增 workflow dispatch model / service。
- 支持 task `assigned` 中间态。
- 将 scheduled wave 分发到 node inbox。
- 支持 idempotent retry，不重复创建 assignment message。
- 记录 dispatch 成功和失败原因。

本阶段不做：

- 不调用 OpenClaw transport。
- 不等待或处理 agent ACK。
- 不把 task 变成 `running`。
- 不接收 task result。
- 不做 dynamic replanning。

## Task 列表

### T116 Dispatch model and assigned task status

- 新增 dispatch input / result / decision model。
- 新增 task `assigned` 状态。
- 更新 task status transition 规则。

### T117 Dispatch selection service

- 加载 active wave。
- 从 Node Registry 解析 eligible node。
- 支持 preferred_agent / capability matching。
- 返回 selected / rejected decision。

### T118 Dispatch mailbox delivery

- 写入 `TASK_ASSIGNED` mailbox message。
- 将 task 从 `ready` 变成 `assigned`。
- 写 dispatch audit event。
- 支持 retry idempotency。

### T119 Dispatch endpoint

- 新增 runtime-neutral dispatch endpoint。
- 返回结构化 dispatch result。
- `serve` 输出 endpoint。

### T120 Dispatch CLI

- 新增 CLI command。
- 支持 workflow id / optional wave id。
- 与 endpoint 复用同一 service。

### T121 Dispatch tests

- 覆盖 successful dispatch。
- 覆盖 ineligible node rejection。
- 覆盖 retry 不重复消息。
- 覆盖 task 不变成 running。
- 覆盖 endpoint 和 CLI。

### T122 Phase 23 acceptance

- 更新 PRD implementation status。
- 更新 progress README 和 agent handoff 状态。
- 跑通 `npm run typecheck`、`npm run build`、`npm test`。

## 验收标准

1. Scheduled wave 可 dispatch 到 registered node inbox。
2. Dispatch 后 task 状态为 `assigned`，不是 `running`。
3. 不符合 capability / permission / membership 的节点被拒绝并记录原因。
4. 重复 dispatch 不创建重复 assignment message。
5. Endpoint 和 CLI 都可用。
6. Dispatch 不调用 OpenClaw。
7. Phase 01-22 回归测试继续通过。
