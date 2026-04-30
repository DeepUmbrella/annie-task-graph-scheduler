# Phase 15 Summary

## 阶段目标

让每个 runtime-agnostic agent / node 自己声明 action 和消息目标，TaskGraphScheduler 只负责校验、投递和记录。

这些 node 不一定来自 OpenClaw；OpenClaw 只是可能的 runtime / transport adapter。

## 阶段状态

`in_progress`

## 关联文档

- [Multi-Agent Autonomous Workflow PRD](../../docs/multi_agent_autonomous_workflow_prd.md)
- [Phase 15 Plan](../../docs/plans/phase-15-plan.md)
- [Phase 14 Summary](../phase-14/phase-summary.md)

## Task 列表

| ID | 状态 | 任务 |
|---|---|---|
| T075 | done | [Agent action policy model](./tasks/task-075-agent-action-policy-model.md) |
| T076 | todo | [Self-routed agent message intake](./tasks/task-076-self-routed-agent-message-intake.md) |
| T077 | todo | [Remove planner reply compatibility](./tasks/task-077-remove-planner-reply-compatibility.md) |
| T078 | todo | [Docs and progress update](./tasks/task-078-docs-and-progress-update.md) |
| T079 | todo | [Phase 15 验收测试](./tasks/task-079-phase-15-acceptance.md) |

## 当前进度

- Phase 01-14 已完成。
- Phase 15 已开始实施。
- 已完成 T075：Agent action policy model。
- 下一步进入 T076：Self-routed agent message intake。

## 阶段完成标准

1. agent message 必须显式声明 `action`。
2. agent message 必须显式声明 `to`。
3. action 必须通过 agent action policy 校验。
4. runtime-neutral `/agent-messages` 是唯一 agent message intake route。
5. `/openclaw/agent-messages` 被移除。
6. `/openclaw/planner-replies` 被移除。
7. node identity / policy 不绑定到 OpenClaw。
8. Phase 01-14 回归测试继续通过。
