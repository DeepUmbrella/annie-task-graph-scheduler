# T120 Dispatch CLI

## 状态

`done`

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

## 完成记录

- 新增 `workflow-dispatch --workflow <workflow_id> [--wave <wave_id>]`。
- CLI 复用 `dispatchWorkflowWave`。
- 输出 decision、assignments、rejections、message_count、state/audit path。
- 保留旧 `dispatch` CLI 的 worker assignment 语义。

## 验证结果

```txt
npm run typecheck: pass
npm run build: pass
```
