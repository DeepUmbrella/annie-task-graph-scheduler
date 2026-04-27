# T021 Visualization Export

## 状态

`done`

## 目标

提供 visualization JSON 导出边界，让 CLI、Web UI 或 Annie 控制台都能复用同一份 view model。

## 范围

- 新增 export function。
- 可从 `WorkflowState` 生成完整 visualization JSON。
- CLI 增加只读命令，例如 `visualize --workflow <workflow_id>`。
- 不实现具体图形 UI。

## 验收标准

- export function 有单元测试。
- CLI 能读取 StateStore 并输出 JSON。
- 输出 JSON 包含 board、dag、waves、failures。
- 失败读取 state 时返回结构化错误。

## 关联代码

- `src/cli.ts`
- `src/storage/state_store.ts`
- `src/visualization/*`
- `tests/visualization.test.ts`

## 完成记录

- 在 `projection.ts` 中新增 `exportVisualization()` 函数，接受 `WorkflowState | null`，返回 `VisualizationExport`（ok/error 联合类型）。
- 新增 `VisualizationExportResult`、`VisualizationExportError`、`VisualizationExport` 类型定义。
- CLI 新增 `visualize --workflow <workflow_id>` 命令，读取 StateStore 并输出完整 visualization JSON。
- 失败读取 state 时通过 `TaskGraphSchedulerError`（STATE_LOAD_FAILED）或 `VisualizationExportError`（VISUALIZATION_STATE_MISSING）返回结构化错误。
- 补充测试：exportVisualization 对有效 state 返回 ok，对 null 返回 error。
- 验证结果：typecheck pass, build pass, 62 passed。

