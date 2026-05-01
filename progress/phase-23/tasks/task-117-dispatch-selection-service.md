# T117 Dispatch Selection Service

## 状态

`done`

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

## 完成记录

- 新增 `selectDispatchTargets`。
- 支持通过 `current_wave` 或指定 `wave_id` 解析 dispatch wave。
- 支持 preferred node 优先。
- 支持 required capability 匹配。
- 支持 missing task / non-ready task / no eligible node rejection。
- Selection 阶段不写 mailbox、不修改 state。

## 验证结果

```txt
npm run typecheck: pass
```
