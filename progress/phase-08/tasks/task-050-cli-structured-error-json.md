# T050 CLI Structured Error JSON Mode

## 状态

`todo`

## 目标

让 CLI 错误输出具备一致的结构化信息，方便上游 workflow 或编辑器客户端解析。

## 范围

- 扩展 `src/cli.ts` 的 error output helper。
- 覆盖 `TaskGraphSchedulerError` 的 `code`、`message`、`details`。
- 增加 CLI 错误 e2e 测试。

## 验收标准

- CLI 错误可被机器读取。
- 成功输出 JSON 不变。
- 若需要改变现有 stderr 兼容格式，实施前必须停下来询问用户。

## 关联代码

- `src/cli.ts`
- `tests/e2e_execution_cli.test.ts`
