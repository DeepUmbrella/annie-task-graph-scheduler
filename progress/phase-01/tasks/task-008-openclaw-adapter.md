# T008 OpenClaw Adapter

## 状态

`todo`

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

