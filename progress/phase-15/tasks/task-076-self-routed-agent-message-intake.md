# T076 Self-Routed Agent Message Intake

## 状态

`done`

## 目标

让 agent message intake 使用 agent 显式声明的 action 和 to，不再由 scheduler 默认决定目标。

## 范围

- 更新 `src/agent_message/intake.ts`。
- payload 缺少 `action` 时失败。
- payload 缺少 `to` 时失败。
- 校验 action policy。
- message type 由 payload 显式提供。

## 验收标准

- 缺少 `to` 失败。
- 缺少 `action` 失败。
- 不允许的 action 失败。
- 允许的 `send_message` 成功写入目标 mailbox。

## 关联代码

- `src/agent_message/intake.ts`
- `tests/agent_message_intake.test.ts`

## 完成记录

- `agent_message` payload 必须显式提供 `action`。
- `agent_message` payload 必须显式提供 `to`。
- `agent_message` payload 必须显式提供 `message_type`。
- 移除 `to ?? "annie"` fallback。
- intake 使用 agent action policy 校验 action / message type。

## 验证结果

```txt
npm run typecheck: pass
npm run build: pass
node --test dist/tests/agent_message_intake.test.js: 7 passed
```
