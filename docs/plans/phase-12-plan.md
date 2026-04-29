# Phase 12 Plan: Real OpenClaw Planner Transport

## 背景

Phase 11 已完成本地链路：

```txt
OpenClaw inbound message -> workflow intent -> PLANNING_REQUEST -> team-lead-agent mailbox
```

Phase 12 开始接入真实 OpenClaw CLI，让 planner handoff 不只写入本地 mailbox，也能通过 `openclaw agent` 投递给真实 OpenClaw agent。

## 边界

本阶段做：

- 使用 `openclaw agent --agent <id> --message <text> --json` 作为真实投递入口。
- 保留 MessageBus/Mailbox 作为 Annie 协作协议和审计边界。
- `serve` 支持显式指定真实 planner agent id。
- 默认行为继续使用本地 mock transport，避免破坏现有测试和本地 smoke loop。

本阶段不做：

- 不自动决定哪个 OpenClaw agent 是 controller/planner。
- 不解析真实 planner 的 TaskDagPlan 输出。
- 不生成 DAG，不调度执行 agent。
- 不改变公开 plan schema。

## Task 列表

### T064 Real OpenClaw CLI client

- 新增 OpenClaw CLI client，封装 `openclaw agent`。
- 将 Annie `Message` 转换成真实 CLI 投递。
- 支持注入 runner 以便单元测试。

### T065 Serve real planner transport

- `serve` 增加显式参数指定真实 planner agent。
- inbound auto-handoff 使用真实 OpenClaw transport。
- response / log 暴露 planner delivery status。

### T066 Phase 12 acceptance

- 更新 smoke-test 文档。
- 更新 progress README 和 agent handoff 状态。
- 跑通 `npm run typecheck`、`npm run build`、`npm test`。

## 验收标准

启动命令可显式接入真实 OpenClaw planner：

```txt
npm run serve -- --root .annie --host 127.0.0.1 --port 4317 --openclaw-planner-agent <agent_id>
```

收到 inbound message 后：

1. 写入 inbound JSONL。
2. 创建 workflow intent。
3. 写入 planner mailbox。
4. 调用真实 `openclaw agent --agent <agent_id> --message ... --json`。
5. response / log 中可观察 delivery status。

## 需要用户确认的运行时选择

当前本机 `openclaw agents list --json` 可见多个 agent，例如 `develop-team`、`annie-pm`、`annie-dev`。Phase 12 不默认选择 controller/planner，运行时必须显式传入 `--openclaw-planner-agent <agent_id>`。
