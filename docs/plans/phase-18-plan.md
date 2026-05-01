# Phase 18 Plan: Node Registration Interview

## 背景

Phase 17 已完成 runtime discovery 和 candidate nodes。Candidate 仍然不是 registered node。

Phase 18 要实现 candidate interview：系统向 candidate 要求按 `NodeRegistrationProposal` 格式描述自己，解析回复，并通过审批边界决定 `granted_actions`。

关键产品规则：

```txt
Candidate interview may produce NodeRegistrationProposal.
NodeRegistrationProposal validation does not imply approval.
requested_actions are not granted_actions.
```

## 目标

实现最小 Node Registration Interview：

- 为 candidate node 生成 registration interview template。
- 从 runtime reply 中解析 `NodeRegistrationProposal`。
- 提供 action approval boundary。
- 修正注册语义：未审批 proposal 不自动授予 requested actions。

## 边界

本阶段做：

- 新增 `src/node_registration_interview/*`。
- 支持生成 interview prompt / request。
- 支持解析 JSON object / JSON text / fenced JSON。
- 支持系统审批策略，把 requested actions 过滤为 granted actions。
- 让 `/nodes/register` 保持只接收 proposal，但 proposal 中的 `granted_actions` 才是授权来源。

本阶段不做：

- 不直接调用真实 OpenClaw session。
- 不实现用户审批 UI。
- 不自动把 candidate interview reply 写入 registry。
- 不新增复杂 action type。

## Task 列表

### T090 Registration interview template

- 定义 `NodeRegistrationInterviewRequest`。
- 从 `CandidateNode` 生成模板。
- 明确要求回复 `node-registration.v1` JSON。

### T091 Proposal reply parser

- 支持解析 object reply。
- 支持解析 text/content/reply/message 字段里的 JSON。
- 支持 fenced JSON。
- 解析后使用 registry model validation。

### T092 Registration approval boundary

- 定义 `NodeRegistrationApprovalPolicy`。
- 将 `requested_actions` 按 policy 过滤为 `granted_actions`。
- 默认不自动批准任何 action。

### T093 Registration intake semantics

- 修正 `normalizeNodeRegistrationProposal` 默认授权语义。
- `/nodes/register` 继续注册 proposal，但不从 requested actions 自动授权。
- 增加审批后 proposal 注册测试。

### T094 Phase 18 acceptance

- 更新 PRD implementation status。
- 更新 progress README 和 agent handoff 状态。
- 跑通 `npm run typecheck`、`npm run build`、`npm test`。

## 验收标准

1. Candidate 可生成 registration interview request。
2. Runtime reply 可解析成 `NodeRegistrationProposal`。
3. Parser 对无效 JSON / schema 返回结构化错误。
4. Approval policy 控制 `granted_actions`。
5. 未审批 proposal 不自动获得 requested actions。
6. Phase 01-17 回归测试继续通过。
