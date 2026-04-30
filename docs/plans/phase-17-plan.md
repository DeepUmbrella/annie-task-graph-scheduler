# Phase 17 Plan: Runtime Discovery And Candidate Nodes

## 背景

Phase 16 已完成 runtime-agnostic Node Registry。下一步需要发现本机可用 runtime，并把发现结果保存为 candidate nodes。

关键产品规则：

```txt
Discovery is not registration.
CandidateNode is not RegisteredNode.
Runtime discovery may suggest nodes, but only NodeRegistrationProposal can register nodes.
```

## 目标

实现最小 runtime discovery boundary：

- 定义 runtime detector。
- 定义 candidate node model。
- 支持 OpenClaw discovery adapter。
- 保存 discovery metadata。
- 提供 candidate node list。

## 边界

本阶段做：

- 新增 `src/runtime_discovery/*`。
- 定义 `RuntimeCandidate` / `CandidateNode` / `RuntimeDiscoverySnapshot`。
- 实现本地 JSON discovery store。
- 实现 OpenClaw CLI discovery adapter 的可注入 runner。
- 提供 discovery orchestration helper。
- 提供 `GET /nodes/candidates`。

本阶段不做：

- 不做 candidate interview。
- 不自动注册 node。
- 不调用 `/nodes/register`。
- 不授予 action policy。
- 不要求真实 OpenClaw 在测试环境可用。

## Task 列表

### T085 Runtime discovery models

- 定义 runtime 和 candidate node 模型。
- 明确 candidate 与 registered node 的差异。
- 校验基础字段。

### T086 Runtime discovery store

- 实现 `.annie/discovery/runtime-candidates.json`。
- 支持保存 snapshot。
- 支持读取 candidate node list。

### T087 OpenClaw discovery adapter

- 实现可注入 runner 的 OpenClaw discovery adapter。
- 解析 `openclaw agents list --json` 的最小结果。
- 失败时输出 runtime unavailable metadata。

### T088 Candidate nodes endpoint and CLI surface

- 新增 `GET /nodes/candidates`。
- `serve` 输出 candidates endpoint。
- 可选新增 CLI discovery 命令。

### T089 Phase 17 acceptance

- 更新 PRD implementation status。
- 更新 progress README 和 agent handoff 状态。
- 跑通 `npm run typecheck`、`npm run build`、`npm test`。

## 验收标准

1. runtime discovery 不会写入 Node Registry。
2. CandidateNode 可被持久化和读取。
3. OpenClaw adapter 可通过 injected runner 测试。
4. OpenClaw 不可用时返回 unavailable metadata，不破坏服务启动。
5. `GET /nodes/candidates` 返回 discovery snapshot。
6. Phase 01-16 回归测试继续通过。
