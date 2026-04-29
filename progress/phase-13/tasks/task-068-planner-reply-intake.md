# T068 Planner Reply Intake

## 状态

`done`

## 目标

把真实 planner agent 的自然语言回复转换为结构化 `REQUIREMENT_CLARIFICATION_REQUEST`。

## 范围

- 新增 `src/planner_reply/*`。
- 提取 `intent_id`、`from`、reply text。
- 从 reply text 中提取问题列表。
- 写入 Annie mailbox。

## 验收标准

- planner reply 可以生成 `REQUIREMENT_CLARIFICATION_REQUEST`。
- message 写入 `.annie/workflows/<intent_id>/mailboxes/annie/inbox.jsonl`。
- payload 保留原始 reply text。

## 关联代码

- `src/planner_reply/*`
- `tests/planner_reply_intake.test.ts`

## 完成记录

- 新增 `src/planner_reply/intake.ts`。
- 支持从 `intent_id` / `workflow_id`、`from` / `agent_id`、`message` / `text` 等字段读取 planner reply。
- 从自然语言回复中提取澄清问题列表。
- 生成 `REQUIREMENT_CLARIFICATION_REQUEST` 并写入 Annie inbox。
- 测试覆盖真实 `develop-team` 回复样例。

## 验证结果

```txt
npm run typecheck: pass
npm run build: pass
node --test dist/tests/planner_reply_intake.test.js: 4 passed
```
