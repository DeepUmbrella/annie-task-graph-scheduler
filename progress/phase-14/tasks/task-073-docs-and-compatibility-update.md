# T073 Docs And Compatibility Update

## 状态

`done`

## 目标

更新文档，说明 Phase 14 是对 Phase 13 的泛化修正。

## 范围

- 更新 `docs/local_openclaw_inbound_smoke_test.md`。
- 更新 progress README。
- 更新 agent handoff 状态。
- 在 Phase 13 summary 中标注已由 Phase 14 泛化。

## 验收标准

- 文档推荐使用 `/openclaw/agent-messages`。
- 文档说明 `/openclaw/planner-replies` 是兼容 alias。

## 关联代码

- `docs/local_openclaw_inbound_smoke_test.md`
- `progress/README.md`
- `agent.md`
- `progress/phase-13/phase-summary.md`

## 完成记录

- smoke-test 文档推荐使用 `/openclaw/agent-messages`。
- 文档说明 `/openclaw/planner-replies` 是兼容 alias。
- Phase 13 summary 标注已由 Phase 14 泛化。
- 文档中的 log、response 和 mailbox 描述已改为 agent message 语义。

## 验证结果

```txt
Documentation-only change; full validation belongs to T074.
```
