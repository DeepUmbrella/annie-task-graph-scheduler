# T117 Dispatch Selection Service

## 状态

`todo`

## 目标

实现 active wave task 到 registered node 的选择和拒绝原因。

## 范围

- 加载 workflow state 和 active wave。
- 加载 Node Registry。
- 按 preferred_agent / required_capabilities 选择 node。
- 校验 granted action 和 team membership。

## 验收标准

- 可选出 eligible node。
- 无 eligible node 时返回结构化 rejection。
- 不写 mailbox、不改 state。

## 关联代码

- `src/workflow_dispatch/selection.ts`
- `src/node_registry/index.ts`
