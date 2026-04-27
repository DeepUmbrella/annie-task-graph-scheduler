# T038 CLI Submit Result

## 状态

`todo`

## 目标

实现 `submit-result --workflow <workflow_id> --result <result.json>`，从 CLI 提交 worker 结构化结果。

## 范围

- 扩展 `src/cli.ts`。
- 读取 result JSON 文件。
- 调用 `collectResult`。
- 保存 next state。
- 追加 audit events。
- 输出 task result summary JSON。

## 验收标准

- completed result 将 running task 推进到 reviewing。
- failed result 将 running task 推进到 failed 或 ready（按 retry policy）。
- 无效 result schema 返回结构化错误。
- 结果中的 changed_files、tests_run、risks 被写入 state。

## 关联代码

- `src/cli.ts`
- `src/execution/result_collector.ts`
- `tests/e2e_execution_cli.test.ts`
