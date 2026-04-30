# Phase 14 Plan: Generic Agent Message Intake

## 背景

Phase 13 完成了 planner clarification reply intake，但设计过窄：它把真实 agent 回复和 planner 澄清请求绑定在一起。

Phase 14 将其泛化为统一 agent message intake。`REQUIREMENT_CLARIFICATION_REQUEST` 只是通用 agent message intake 中的一种分类结果。

## 边界

本阶段做：

- 新增 `src/agent_message/*` 作为通用 agent message intake。
- 新增 `POST /openclaw/agent-messages`。
- 保留 `POST /openclaw/planner-replies` 作为兼容 alias。
- 保留 Phase 13 行为和 mailbox 输出。

本阶段不做：

- 不解析 TaskDagPlan。
- 不实现复杂 LLM intent classifier。
- 不移除旧 planner reply API。
- 不改变既有 message schema。

## Task 列表

### T071 Generic agent message intake module

- 新增 `AgentMessagePayload` / `AgentMessageIntakeResult`。
- 泛化 payload parsing 和 clarification extraction。
- 保留 planner reply wrapper 兼容旧导入。

### T072 Generic agent message HTTP endpoint

- 新增 `POST /openclaw/agent-messages`。
- 旧 `POST /openclaw/planner-replies` 调用同一 intake。
- response 字段表达为 generic agent message metadata。

### T073 Docs and compatibility update

- 更新 smoke-test 文档。
- 更新 Phase 13 相关文档，标注 Phase 14 泛化。
- 更新 progress README 和 agent handoff 状态。

### T074 Phase 14 acceptance

- 跑通 `npm run typecheck`。
- 跑通 `npm run build`。
- 跑通 `npm test`。

## 验收标准

通用 endpoint 可用：

```txt
POST /openclaw/agent-messages
```

旧 endpoint 继续可用：

```txt
POST /openclaw/planner-replies
```

两者都可以把 agent clarification reply 写入：

```txt
.annie/workflows/<intent_id>/mailboxes/annie/inbox.jsonl
```
