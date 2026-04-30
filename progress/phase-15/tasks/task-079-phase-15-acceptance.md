# T079 Phase 15 Acceptance

## 状态

`done`

## 目标

完成 Phase 15 验收和进度记录，确认 agent action policy 和 self-routed message intake 可用。

## 范围

- 跑通 `npm run typecheck`。
- 跑通 `npm run build`。
- 跑通 `npm test`。
- 更新 `progress/phase-15/phase-summary.md`。
- 更新 `progress/README.md`。
- 更新 `agent.md`。

## 验收标准

- Phase 15 所有 task 标记为 done。
- Phase 01-14 回归测试继续通过。
- agent action policy / self-routed intake 测试通过。

## 关联代码

- `progress/phase-15/phase-summary.md`
- `progress/README.md`
- `agent.md`

## 完成记录

- Phase 15 所有 task 已标记为 `done`。
- agent / node message 必须显式声明 `action`。
- agent / node message 必须显式声明 `to`。
- action 通过 runtime-agnostic policy 校验。
- `/agent-messages` 是唯一 agent message intake route。
- `/openclaw/agent-messages` 已移除。
- `/openclaw/planner-replies` 已移除。
- `src/planner_reply/*` 已移除。

## 验证结果

```txt
npm run typecheck: pass
npm run build: pass
npm test: 146 passed
```
