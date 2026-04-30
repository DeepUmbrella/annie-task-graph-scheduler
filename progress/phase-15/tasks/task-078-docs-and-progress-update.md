# T078 Docs And Progress Update

## 状态

`done`

## 目标

更新文档，说明 runtime-agnostic node 自己决定 action / to，旧 planner endpoint 已移除。

## 范围

- 更新 `docs/local_openclaw_inbound_smoke_test.md`。
- 更新 Phase 14 summary。
- 更新 progress README。
- 更新 agent handoff 状态。

## 验收标准

- 文档不再推荐 `/openclaw/agent-messages`。
- 文档不再推荐 `/openclaw/planner-replies`。
- 文档推荐 `/agent-messages`。
- 文档示例 payload 包含 `action` 和 `to`。
- 文档说明 node 不一定来自 OpenClaw。

## 关联代码

- `docs/local_openclaw_inbound_smoke_test.md`
- `progress/README.md`
- `agent.md`
- `progress/phase-14/phase-summary.md`

## 完成记录

- smoke-test 文档改为推荐 `/agent-messages`。
- smoke-test 示例 payload 增加 `action`、`to`、`message_type`。
- Phase 14 summary 标注 Phase 15 移除了 runtime-specific agent message 路由。
- progress README 标记 Phase 15 正在推进。
- agent handoff 状态更新到 T075-T077 done，下一步 T078/T079。

## 验证结果

```txt
Documentation and progress update; full validation belongs to T079.
```
