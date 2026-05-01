# T126 Result Intake CLI

## 状态

`done`

## 目标

提供 CLI command 执行 result intake。

## 范围

- 新增 CLI command。
- 支持 workflow id、from node、result JSON file。
- 与 endpoint 复用同一 service。

## 验收标准

- CLI 可提交 task result。
- CLI structured JSON error 与既有风格一致。
- CLI 不自动 review。

## 关联代码

- `src/cli.ts`
- `src/result_intake/intake_result.ts`

## 完成记录

- 新增 `agent-result --workflow <workflow_id> --from <node_id> --result <result.json> [--wave <wave_id>]`。
- CLI 复用 `intakeAgentResult`。
- 输出 decision、state path、audit path。
- CLI 不自动 review。

## 验证结果

```txt
npm run typecheck: pass
npm run build: pass
```
