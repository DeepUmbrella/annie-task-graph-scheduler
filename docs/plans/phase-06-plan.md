# Phase 06 Plan: Execution CLI Orchestration

## Context

Phase 01-05 已完成调度内核、增强策略、可视化投影、任务模板和跨项目调度基础能力。当前距离 PRD / 实现计划完整闭环仍有一个明显缺口：实现计划第 7 节列出的执行 CLI 入口尚未落地。

当前已完成：

- DAG plan loading / validation。
- ready / blocked dependency resolution。
- wave generation。
- worker assignment。
- result collection。
- review gate。
- state persistence / recovery。
- MessageBus / Mailbox / OpenClaw adapter boundary。
- visualization / template / cross-project queue CLI。

当前未完成的核心闭环：

- `init --plan <plan.json>`：从 plan 创建 workflow state。
- `next-wave --workflow <workflow_id>`：解析依赖并生成下一 wave。
- `dispatch --workflow <workflow_id> --wave <wave_id>`：分配 worker 并持久化 state。
- `submit-result --workflow <workflow_id> --result <result.json>`：提交 worker 结果。
- `review-wave --workflow <workflow_id> --wave <wave_id>`：执行 ReviewGate 并推进 task 状态。

Phase 06 目标是把已有内核串成可用的本地执行 CLI 闭环，让外部 Annie Orchestrator、脚本或用户能用 CLI 驱动单 workflow 从 DAG plan 到 wave review。

Phase 06 不引入真实 OpenClaw session 调用、不做多用户权限、不改变现有 plan schema。

## Estimated Completion After Phase 05

按 PRD 与当前实现对照：

- 核心调度内核：已完成。
- 增强调度：已完成。
- 可视化数据边界：已完成。
- 模板能力：已完成。
- 跨项目调度基础：已完成。
- 单 workflow 执行 CLI 闭环：未完成，是 Phase 06 目标。
- 长期记忆接入：未完成，建议作为 Phase 07。
- 真实 OpenClaw runtime 执行：仍保持 adapter boundary，是否进入后续 phase 需要用户确认。

粗略进度判断：核心产品能力约 80%-85% 完成；完成 Phase 06 后，单机本地版 TaskGraphScheduler 将接近 PRD 可运行闭环。

## Tasks

### T035 CLI init

- 扩展 `src/cli.ts`
- 支持 `init --plan <plan.json> [--workflow <workflow_id>]`
- 使用 `loadPlanFile` + `createInitialWorkflowState`
- 保存 state 到 StateStore
- 输出 workflow summary JSON

### T036 CLI next-wave

- 扩展 `src/cli.ts`
- 支持 `next-wave --workflow <workflow_id>`
- 加载 workflow state
- 调用 `resolveDependencies`
- 调用 `generateNextWave`
- 持久化状态变化和新增 wave
- 输出 wave decision JSON

### T037 CLI dispatch

- 扩展 `src/cli.ts`
- 支持 `dispatch --workflow <workflow_id> --wave <wave_id>`
- 加载 workflow state 和指定 wave
- 调用 `assignWorkers`
- 保存 state
- 追加 assignment audit events
- 输出 assignments JSON

### T038 CLI submit-result

- 扩展 `src/cli.ts`
- 支持 `submit-result --workflow <workflow_id> --result <result.json>`
- 读取 worker result JSON
- 调用 `collectResult`
- 保存 state
- 追加 audit events
- 输出 task result summary JSON

### T039 CLI review-wave

- 扩展 `src/cli.ts`
- 支持 `review-wave --workflow <workflow_id> --wave <wave_id>`
- 调用 `reviewWave`
- 保存 state
- 追加 audit events
- 输出 review decision JSON

### T040 Execution CLI e2e

- 新增 `tests/e2e_execution_cli.test.ts`
- 覆盖 `init -> next-wave -> dispatch -> submit-result -> review-wave -> next-wave`
- 覆盖失败结果阻塞下游
- 覆盖文件冲突 / skipped reason 输出

### T041 Phase 06 acceptance

- 完成 Phase 06 验收
- 确认 Phase 01-05 回归测试通过
- 更新 progress README、phase summary 和 agent.md

## Key Files

- `src/cli.ts` — 扩展
- `tests/e2e_execution_cli.test.ts` — 新增
- `progress/phase-06/phase-summary.md` — 新增
- `progress/phase-06/tasks/*` — 新增

## Verification

```txt
npm run typecheck
npm run build
npm test
```

Phase 06 完成时，应能通过 CLI 驱动一个本地 workflow 完成至少一轮 wave 调度、worker 分配、结果提交和 ReviewGate。
