# T008 OpenClaw Adapter

## 状态

`done`

## 完成记录

- 完善 `TransportAdapter`，以 Annie `Message` 为边界。
- 保留并收紧 `MockAdapter`。
- 实现 `OpenClawAdapter`。
- 实现 `toOpenClawEnvelope(...)`。
- 支持通过 `agent_sessions` 将 Agent 映射到底层 session。
- 补充 OpenClaw adapter 单元测试。

## 验证

```txt
npm run typecheck
npm run build
npm test
```

全部通过。

## 目标

在调度内核稳定后接入 OpenClaw 传输适配层。

## 范围

- 完善 `TransportAdapter` 接口。
- 保留 MockAdapter 用于测试。
- 实现 OpenClawAdapter 的消息转换边界。
- 将 Annie Message 转换为 session spawn / send。
- 将 session 回复转换为 Annie Message。

## 验收标准

- 调度器不直接依赖 OpenClaw 原始通信。
- MessageBus 只依赖 TransportAdapter。
- OpenClaw 发送失败不直接等于任务失败，而是进入消息重试或上报流程。
- MockAdapter 仍可支持所有单元测试和 e2e 测试。

## 关联代码

- `src/communication/openclaw_adapter.ts`
- `src/communication/message_bus.ts`
