# Phase 19 Plan: Team Delegation Actions

## 背景

Phase 18 已完成 node registration interview 和显式授权语义。下一步需要让 team member 在 team context 内表达委派动作。

关键产品规则：

```txt
Node decides the action and target.
Scheduler validates action policy, team context, and message delivery.
Delegation message does not directly mutate task state.
```

## 目标

实现最小 Team Delegation Actions：

- 定义 `delegate_to_member` action。
- 定义 delegation payload model。
- 校验 sender 属于 claimed team。
- 校验 target 属于同一 team。
- 支持通过 agent message intake 投递 `TASK_ASSIGNED`。

## 边界

本阶段做：

- 扩展 action policy。
- 新增 `src/team_delegation/*`。
- 支持 team-scoped delegation validation。
- 支持 `team_context` payload parsing。
- 增加 registry-derived action policy 对 delegation 的支持。

本阶段不做：

- 不改变 WorkflowState task status。
- 不创建新 task。
- 不实现复杂角色权限矩阵。
- 不把 delegation 自动转为 scheduler assignment。

## Task 列表

### T095 Delegation action model

- 新增 `delegate_to_member` action。
- 定义 delegation message types。
- 扩展 action policy permission helper。

### T096 Team delegation validator

- 校验 sender 已注册。
- 校验 sender 属于 team context。
- 校验 target 是同 team member。
- 校验 action policy 允许 delegation message type。

### T097 Agent message team context intake

- 解析 `team_context`。
- 对 `delegate_to_member` 运行 team delegation validation。
- 允许投递 `TASK_ASSIGNED` 到 member inbox。

### T098 Registry-derived delegation policy

- 从 registered nodes 的 `granted_actions` 派生 delegation permission。
- 保持未授权默认拒绝。

### T099 Phase 19 acceptance

- 更新 PRD implementation status。
- 更新 progress README 和 agent handoff 状态。
- 跑通 `npm run typecheck`、`npm run build`、`npm test`。

## 验收标准

1. 已授权 team member 可以向同 team member 发送 `TASK_ASSIGNED`。
2. 非 team member 声称 team context 时失败。
3. target 不属于同 team 时失败。
4. 未授权 `delegate_to_member` 时失败。
5. Delegation intake 只写 mailbox，不改 workflow state。
6. Phase 01-18 回归测试继续通过。
