# Phase 16 Plan: Node Registry And Team Composition

## 背景

Phase 15 已完成 self-routed agent message intake：node / agent 必须显式声明 `action`、`to` 和 `message_type`，调度器只做 action policy 校验和 mailbox 投递。

下一步需要把 action policy 的主体从临时默认列表推进到持久化 Node Registry。

PRD 修订规则：

```txt
node 是 runtime-agnostic 的协作主体。
OpenClaw 只是 runtime / discovery / transport adapter。
team / individual 由语义决定，不由成员数量决定。
单成员 team 仍然可以注册为 team。
```

## 目标

实现最小 Node Registry 和 Team Composition：

- 注册 individual node。
- 注册 team node。
- 注册单成员 team。
- 保存 team composition。
- 提供 runtime-neutral `POST /nodes/register`。
- 提供 `GET /nodes`。
- 提供 team context validation boundary。

## 边界

本阶段做：

- 新增 `src/node_registry/*`。
- 定义 `RegisteredNode`、`TeamComposition`、`NodeRegistrationProposal`。
- 实现本地 JSON registry。
- 实现 proposal validation。
- 实现 `/nodes/register` 和 `GET /nodes`。
- 支持单成员 team。
- 从 registered nodes 派生 action policy。
- 提供 team context validation helper。

本阶段不做：

- 不做 RuntimeDiscovery。
- 不调用 `openclaw agents list --json`。
- 不做 candidate interview。
- 不做用户审批 UI。
- 不实现复杂团队内部 delegation action。

## Task 列表

### T080 Node registry models

- 定义 `RegisteredNode`。
- 定义 `TeamComposition`。
- 定义 `NodeRegistrationProposal`。
- 定义 `TeamContext`。
- 校验 team / individual 语义和基础字段。

### T081 Local node registry persistence

- 实现 `.annie/nodes/registry.json`。
- 支持注册 proposal。
- 支持 list snapshot。
- 支持重复注册更新。

### T082 Node registration HTTP endpoints

- 新增 `POST /nodes/register`。
- 新增 `GET /nodes`。
- response 返回 registered node/team counts。

### T083 Team context and action policy integration

- 实现 team context validation helper。
- 从 registered nodes 派生 `AgentActionPolicy`。
- 保留默认 policy 作为无 registry 时的 fallback。

### T084 Phase 16 acceptance

- 更新 smoke-test / PRD implementation status。
- 更新 progress README 和 agent handoff 状态。
- 跑通 `npm run typecheck`、`npm run build`、`npm test`。

## 验收标准

1. 可以注册 individual node。
2. 可以注册 team node。
3. 可以注册单成员 team。
4. team member 必须是 registered node 或同 proposal 内 node。
5. `GET /nodes` 返回 nodes 和 team compositions。
6. team context validation 能确认 member 属于 team。
7. action policy 可以从 node registry 派生。
8. 所有测试通过。
