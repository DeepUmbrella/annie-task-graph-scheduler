# T065 Serve Real Planner Transport

## 状态

`todo`

## 目标

让 inbound server 在显式指定 OpenClaw planner agent 时，真实调用 OpenClaw CLI 投递 `PLANNING_REQUEST`。

## 范围

- 扩展 `src/planning/handoff.ts`，允许注入 transport。
- 扩展 `src/server/inbound_server.ts`，允许注入 team / planner transport。
- 扩展 `src/cli.ts` 的 `serve` 参数。
- 补充 inbound server 测试。

## 验收标准

- 默认 `serve` 仍走 mock transport。
- `serve --openclaw-planner-agent <agent_id>` 使用真实 OpenClaw transport。
- response 包含 planner delivery status。
- 不默认选择 controller/planner agent。

## 关联代码

- `src/planning/handoff.ts`
- `src/server/inbound_server.ts`
- `src/cli.ts`
- `tests/inbound_server.test.ts`
