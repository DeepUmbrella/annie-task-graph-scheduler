# T022 Phase 03 Acceptance

## 状态

`todo`

## 目标

完成 Phase 03 验收和回归测试，确保 visualization projection 不破坏调度内核。

## 范围

- 增加 Phase 03 e2e fixture。
- 覆盖 board / dag / waves / failures。
- 更新 README。
- 更新 `agent.md` 和 `progress/README.md` 的 phase-level 状态。
- 保持 Phase 01 / Phase 02 回归测试通过。

## 验收标准

- `npm run typecheck` 通过。
- `npm run build` 通过。
- `npm test` 通过。
- Visualization JSON 输出稳定。
- `progress/phase-03/phase-summary.md` 标记为 `done`。

## 关联代码

- `src/visualization/*`
- `tests/visualization.test.ts`
- `README.md`
- `agent.md`
- `progress/README.md`

