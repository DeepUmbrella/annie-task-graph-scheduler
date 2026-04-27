# T034 Phase 05 Acceptance

## 状态

`done`

## 目标

完成 Phase 05 验收和回归测试，确保跨项目调度不破坏既有单 workflow 能力。

## 范围

- 增加 project registry 单元测试。
- 增加 global queue builder 单元测试。
- 增加 cross-project scheduler 单元测试。
- 增加 CLI project / queue e2e。
- 更新 README。
- 更新 `agent.md` 和 `progress/README.md` 的 phase-level 状态。

## 验收标准

- `npm run typecheck` 通过。
- `npm run build` 通过。
- `npm test` 通过。
- Phase 01-04 回归测试继续通过。
- Phase 05 新增验收测试通过。
- `progress/phase-05/phase-summary.md` 标记为 `done`。

## 关联代码

- `src/projects/*`
- `tests/project_registry.test.ts`
- `tests/cross_project_scheduler.test.ts`
- `tests/e2e_phase_05.test.ts`
- `README.md`
- `agent.md`
- `progress/README.md`

## 完成记录

- 确认 T028-T033 全部完成。
- Phase 05 覆盖 project registry、global queue builder、cross-project scheduler、global agent pool、project / queue CLI。
- Phase 01-04 回归测试继续通过。
- 更新 progress README、phase summary 和 agent.md。

## 验证结果

```txt
npm run typecheck
npm run build
npm test
90 passed
```
