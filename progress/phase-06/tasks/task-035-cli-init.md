# T035 CLI Init

## 状态

`done`

## 目标

实现 `init --plan <plan.json>`，从 DAG plan 创建并持久化 workflow state。

## 范围

- 扩展 `src/cli.ts`。
- 支持 `init --plan <plan.json> [--workflow <workflow_id>]`。
- 使用 `loadPlanFile` 读取和校验 plan。
- 使用 `createInitialWorkflowState` 创建 state。
- 使用 StateStore 保存 state。
- 输出 JSON summary。

## 验收标准

- 合法 plan 可以初始化 workflow。
- 未传 `--workflow` 时自动生成稳定格式 workflow id。
- 初始化后 `.annie/workflows/<workflow_id>/state.json` 存在。
- 非法 plan 返回结构化错误。

## 关联代码

- `src/cli.ts`
- `src/validation/plan_loader.ts`
- `src/storage/state_store.ts`
- `tests/e2e_execution_cli.test.ts`

## 完成记录

- 新增 `init --plan <plan.json> [--workflow <workflow_id>]` CLI。
- 未传 `--workflow` 时按 `wf_<plan_id>` 生成可预测 workflow id。
- 使用 `loadPlanFile` 校验 plan，使用 `createInitialWorkflowState` 创建 state。
- 使用 StateStore 保存 `.annie/workflows/<workflow_id>/state.json`。
- 新增 `tests/e2e_execution_cli.test.ts` 覆盖自动 workflow id 和显式 workflow id。

## 验证结果

```txt
npm run typecheck
npm run build
npm test
92 passed
```
