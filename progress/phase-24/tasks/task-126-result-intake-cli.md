# T126 Result Intake CLI

## 状态

`todo`

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
