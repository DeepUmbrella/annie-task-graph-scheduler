# Phase 15 Plan: Agent Action Policy And Self-Routed Messages

## 背景

Phase 14 把 planner reply intake 泛化为 agent message intake，但仍有两个不符合目标架构的遗留点：

1. `agent_message` 在缺少 `to` 时默认发给 `annie`。
2. `/openclaw/agent-messages`、`/openclaw/planner-replies` 和 `planner_reply` 兼容层仍然存在。

用户确认的新边界是：

```txt
每个 agent / node 自己决定下一步动作和消息目标。
这些 node 不一定来自 OpenClaw。
调度器不替 agent 决定发给谁。
调度器负责校验、记录、投递和审计。
```

## 目标

定义 runtime-agnostic node action policy，并让 agent message intake 使用 node 自己声明的 action / to。

OpenClaw 在本阶段只是一个可能的 runtime / transport adapter。Action policy 的主体是 Annie 的 node / agent，不应绑定到 OpenClaw agent config。

## 边界

本阶段做：

- 定义 agent action model。
- 定义每个 node / agent 可以执行哪些 action。
- `agent_message` payload 必须显式提供 `to`。
- `agent_message` payload 必须显式提供 action，最小支持 `send_message`。
- scheduler / intake 校验 action 是否被允许。
- 新增 runtime-neutral `/agent-messages` endpoint，作为唯一 agent message intake route。
- 删除 `/openclaw/agent-messages` endpoint。
- 删除 `/openclaw/planner-replies` endpoint。
- 删除 `src/planner_reply/*` 和旧 planner reply tests。
- 更新文档，不再提旧 endpoint 兼容。

本阶段不做：

- 不实现复杂权限 UI。
- 不实现任何特定 runtime config 到 action policy 的自动映射。
- 不把 node identity 绑定到 OpenClaw agent identity。
- 不解析 TaskDagPlan。
- 不调度执行 agent。
- 不做多租户安全系统。

## 设计原则

Node output should be self-routed:

```json
{
  "intent_id": "intent_001",
  "from": "develop-team",
  "runtime": "openclaw",
  "action": "send_message",
  "to": "annie",
  "message_type": "REQUIREMENT_CLARIFICATION_REQUEST",
  "message": "网站类型 — 是什么网站？"
}
```

TaskGraphScheduler should:

1. Validate `from` exists in the policy.
2. Validate `action` is allowed for `from`.
3. Validate `message_type` is allowed for that action.
4. Validate `to` is explicit and non-empty.
5. Preserve optional runtime metadata such as `runtime`.
6. Write the resulting Annie Message to the target mailbox.

TaskGraphScheduler should not:

1. Guess `to`.
2. Infer the agent's next action without an action field.
3. Keep runtime-specific agent message intake paths as primary workflow.

## Task 列表

### T075 Runtime-agnostic node action policy model

- 新增 `src/agent_action/*`。
- 定义 `AgentActionType`，最小支持 `send_message`。
- 定义 runtime-agnostic `AgentActionPolicy` / `AgentActionPermission`。
- 提供默认 local policy，用于测试和本地运行。

### T076 Self-routed agent message intake

- 更新 `src/agent_message/intake.ts`。
- payload 必须提供 `action` 和 `to`。
- 校验 agent action policy。
- message type 使用 payload 显式声明，最小支持 `REQUIREMENT_CLARIFICATION_REQUEST`。
- 移除 `to ?? "annie"` fallback。

### T077 Remove runtime-specific agent message routes

- 新增 `POST /agent-messages`。
- 删除 `POST /openclaw/agent-messages`。
- 删除 `POST /openclaw/planner-replies`。
- 删除 `receivePlannerReply`。
- 删除 `src/planner_reply/*`。
- 删除 planner reply tests。
- 更新 CLI startup endpoint metadata。

### T078 Docs and progress update

- 更新 smoke-test 文档，只保留 `/agent-messages`。
- 更新 Phase 14 summary，标注 Phase 15 移除了旧兼容路径。
- 更新 progress README 和 agent handoff 状态。

### T079 Phase 15 acceptance

- 跑通 `npm run typecheck`。
- 跑通 `npm run build`。
- 跑通 `npm test`。

## 验收标准

1. `/agent-messages` payload 缺少 `to` 时失败。
2. `/agent-messages` payload 缺少 `action` 时失败。
3. 不允许的 action 失败。
4. 允许的 `send_message` action 成功写入目标 mailbox。
5. `/openclaw/agent-messages` 不再存在。
6. `/openclaw/planner-replies` 不再存在。
7. `src/planner_reply/*` 不再存在。
8. policy 不要求 node 必须来自 OpenClaw。
9. 所有测试通过。

## 预期启动/调用方式

```txt
POST /agent-messages
```

示例 payload：

```json
{
  "intent_id": "intent_001",
  "from": "develop-team",
  "runtime": "openclaw",
  "action": "send_message",
  "to": "annie",
  "message_type": "REQUIREMENT_CLARIFICATION_REQUEST",
  "message": "网站类型 — 是什么网站？"
}
```
