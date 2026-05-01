# T095 Delegation Action Model

## 状态

`todo`

## 目标

定义 delegation action 和可授权 message type。

## 范围

- 新增 `delegate_to_member` action。
- 新增 delegation permission helper。
- 扩展 action policy tests。

## 验收标准

- action policy 可识别 `delegate_to_member`。
- delegation permission 允许 `TASK_ASSIGNED`。
- 未授权 delegation 时仍然拒绝。

## 关联代码

- `src/agent_action/policy.ts`
- `tests/agent_action.test.ts`
