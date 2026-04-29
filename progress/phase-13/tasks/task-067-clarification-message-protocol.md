# T067 Clarification Message Protocol

## 状态

`done`

## 目标

新增需求澄清请求消息类型，并允许 planner agent 向 Annie / orchestrator 发送。

## 范围

- 更新 `src/models/message.ts`。
- 更新 `src/communication/protocol_validator.ts`。
- 补充 `tests/message_bus.test.ts` 或协议相关测试。

## 验收标准

- `REQUIREMENT_CLARIFICATION_REQUEST` 是合法 message type。
- agent -> annie 方向通过协议校验。
- orchestrator -> agent 的错误方向被拒绝。

## 关联代码

- `src/models/message.ts`
- `src/communication/protocol_validator.ts`
- `tests/message_bus.test.ts`

## 完成记录

- 新增 `REQUIREMENT_CLARIFICATION_REQUEST` message type。
- ProtocolValidator 允许 planner agent 向 `annie` / `orchestrator` 发送澄清请求。
- ProtocolValidator 拒绝 orchestrator 向 agent 发送该类型。
- 补充 message bus 协议测试。

## 验证结果

```txt
npm run typecheck: pass
npm run build: pass
node --test dist/tests/message_bus.test.js: 10 passed
```
