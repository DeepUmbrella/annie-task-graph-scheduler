# T021 Visualization Export

## 状态

`todo`

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

