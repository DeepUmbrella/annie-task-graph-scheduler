# T113 Next-Wave CLI

## 状态

`todo`

## 目标

提供 CLI command 执行 next-wave scheduling。

## 范围

- 新增 CLI command。
- 支持 workflow id。
- 支持 JSON 输出。
- 与 endpoint 复用同一 service。

## 验收标准

- CLI 可 schedule workflow。
- CLI structured JSON error 与既有风格一致。
- CLI 不 dispatch。

## 关联代码

- `src/cli.ts`
- `src/workflow_scheduling/schedule_next_wave.ts`
