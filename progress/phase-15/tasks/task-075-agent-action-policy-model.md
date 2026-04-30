# T075 Agent Action Policy Model

## 状态

`done`

## 目标

定义每个 runtime-agnostic agent / node 可以执行哪些 action。

## 范围

- 新增 `src/agent_action/*`。
- 定义 action type，最小支持 `send_message`。
- 定义 policy / permission model。
- 提供默认 local policy。
- policy 不绑定 OpenClaw agent config。

## 验收标准

- 可以校验 agent 是否允许执行 action。
- 可以校验 action 是否允许发送指定 message type。
- 可以为非 OpenClaw node 定义权限。
- 测试覆盖允许和拒绝路径。

## 关联代码

- `src/agent_action/*`
- `tests/agent_action.test.ts`

## 完成记录

- 新增 runtime-agnostic `AgentActionPolicy` / `AgentActionPermission`。
- 新增 `send_message` action type。
- 新增 `assertAgentActionAllowed`。
- 默认 policy 包含 OpenClaw runtime 节点和非 OpenClaw local 节点。
- 测试覆盖允许、未知节点、action 不允许和 message type 不允许。

## 验证结果

```txt
npm run typecheck: pass
npm run build: pass
node --test dist/tests/agent_action.test.js: 4 passed
```
