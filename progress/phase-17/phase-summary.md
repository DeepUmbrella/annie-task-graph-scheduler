# Phase 17 Summary

## 阶段目标

实现 Runtime Discovery And Candidate Nodes，让系统能发现 OpenClaw 等 runtime 并保存 candidate nodes，但不自动注册。

## 阶段状态

`in_progress`

## 关联文档

- [Multi-Agent Autonomous Workflow PRD](../../docs/multi_agent_autonomous_workflow_prd.md)
- [Phase 17 Plan](../../docs/plans/phase-17-plan.md)
- [Phase 16 Summary](../phase-16/phase-summary.md)

## Task 列表

| ID | 状态 | 任务 |
|---|---|---|
| T085 | done | [Runtime discovery models](./tasks/task-085-runtime-discovery-models.md) |
| T086 | done | [Runtime discovery store](./tasks/task-086-runtime-discovery-store.md) |
| T087 | done | [OpenClaw discovery adapter](./tasks/task-087-openclaw-discovery-adapter.md) |
| T088 | done | [Candidate nodes endpoint and CLI surface](./tasks/task-088-candidate-nodes-endpoint-and-cli-surface.md) |
| T089 | todo | [Phase 17 验收测试](./tasks/task-089-phase-17-acceptance.md) |

## 当前进度

- Phase 01-16 已完成。
- T085：Runtime discovery models 已完成，CandidateNode 与 RegisteredNode 边界已拆开。
- T086：Runtime discovery store 已完成，snapshot 保存到 `.annie/discovery/runtime-candidates.json`。
- T087：OpenClaw discovery adapter 已完成，可将 `openclaw agents list --json` 转换为 candidate nodes。
- T088：Candidate nodes endpoint and CLI surface 已完成，新增 runtime-neutral `GET /nodes/candidates`。
- 下一步：T089 Phase 17 acceptance。

## 阶段完成标准

1. CandidateNode 模型可表达 runtime discovery 结果。
2. Discovery snapshot 可持久化。
3. OpenClaw discovery adapter 可测试。
4. Candidate list 可被 endpoint 读取。
5. Discovery 不自动注册 node。
6. Phase 01-16 回归测试继续通过。
