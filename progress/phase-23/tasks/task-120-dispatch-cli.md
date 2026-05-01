# T120 Dispatch CLI

## 状态

`todo`

## 目标

提供 CLI command 执行 autonomous wave dispatch。

## 范围

- 新增或扩展 CLI command。
- 支持 workflow id 和 optional wave id。
- 与 endpoint 复用同一 service。

## 验收标准

- CLI 可 dispatch scheduled wave。
- CLI structured JSON error 与既有风格一致。
- CLI 不调用 OpenClaw。

## 关联代码

- `src/cli.ts`
- `src/workflow_dispatch/dispatch_wave.ts`
