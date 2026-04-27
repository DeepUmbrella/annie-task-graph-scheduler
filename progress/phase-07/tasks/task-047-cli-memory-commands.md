# T047 CLI Memory Commands

## 状态

`todo`

## 目标

提供 memory candidates 的 CLI 提取、写入和读取能力。

## 范围

- 扩展 `src/cli.ts`。
- `memory extract --workflow <workflow_id>`。
- `memory write --workflow <workflow_id>`。
- `memory list [--category <category>]`。
- 输出 JSON。

## 验收标准

- CLI 可以从 workflow state 输出 memory candidates。
- CLI 可以写入本地 memory store。
- CLI 可以列举本地 memory records。
- category 参数可以过滤 records。
- 错误时输出结构化错误。

## 关联代码

- `src/cli.ts`
- `src/memory/*`
- `tests/e2e_memory_cli.test.ts`
