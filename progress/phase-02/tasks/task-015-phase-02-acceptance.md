# T015 Phase 02 Acceptance

## 状态

`done`

## 完成记录

- 增加 Phase 02 e2e fixture。
- 覆盖风险排序影响 wave 选择。
- 覆盖目录冲突预测。
- 覆盖 transient 自动重试后重新调度成功。
- 验证 Agent 负载释放，修复 ResultCollector 未释放 active task 的问题。
- 更新 README 当前状态与 Phase 02 能力说明。
- Phase 02 summary 标记为完成。

## 验证

```txt
npm run typecheck
npm run build
npm test
```

全部通过，当前测试数：57。

## 目标

完成 Phase 02 的端到端验收和回归测试，确保增强调度不会破坏 Phase 01 的 MVP 行为。

## 范围

- 增加 Phase 02 e2e fixture。
- 覆盖 Agent 满载场景。
- 覆盖风险评分影响 wave 选择场景。
- 覆盖 transient 自动重试场景。
- 覆盖目录 / glob 文件冲突预测场景。
- 更新 progress 文档。
- 更新 README 或 docs 中的使用说明。

## 验收标准

- `npm run typecheck` 通过。
- `npm run build` 通过。
- `npm test` 通过。
- Phase 01 e2e 继续通过。
- Phase 02 e2e 覆盖增强调度核心能力。
- `progress/phase-02/phase-summary.md` 标记为 `done`。

## 关联代码

- `tests/e2e_mvp_flow.test.ts`
- `tests/scheduler.test.ts`
- `tests/execution.test.ts`
- `README.md`
- `progress/phase-02/phase-summary.md`
