# T071 Generic Agent Message Intake Module

## 状态

`done`

## 目标

把 `planner_reply` 的核心能力迁移到通用 `agent_message` 模块。

## 范围

- 新增 `src/agent_message/*`。
- 定义通用 payload / result 类型。
- 保留 `src/planner_reply/*` 作为兼容 wrapper。
- 迁移或新增测试。

## 验收标准

- `intakeAgentMessage` 可以生成 `REQUIREMENT_CLARIFICATION_REQUEST`。
- 旧 `intakePlannerReply` 行为保持不变。
- 测试覆盖通用模块和兼容 wrapper。

## 关联代码

- `src/agent_message/*`
- `src/planner_reply/*`
- `tests/agent_message_intake.test.ts`
- `tests/planner_reply_intake.test.ts`

## 完成记录

- 新增 `src/agent_message/intake.ts` 通用 intake 模块。
- 新增 `intakeAgentMessage`、`parseAgentMessagePayload` 和通用 result 类型。
- `planner_reply` 改为兼容 wrapper，复用通用模块。
- 旧 planner reply 错误码保持兼容。
- 新增通用 intake 测试，旧 planner reply 测试继续通过。

## 验证结果

```txt
npm run typecheck: pass
npm run build: pass
node --test dist/tests/agent_message_intake.test.js: 5 passed
node --test dist/tests/planner_reply_intake.test.js: 4 passed
```
