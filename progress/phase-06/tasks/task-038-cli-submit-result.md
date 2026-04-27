# T038 CLI Submit Result

## 状态

`done`

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

## 完成记录

- 新增 `submit-result --workflow <workflow_id> --result <result.json>` CLI。
- 命令读取 worker result JSON 并交给 `collectResult` 校验和处理。
- 保存 result collection 后的 workflow state。
- 追加 TASK_RESULT_COLLECTED 和 TASK_STATUS_CHANGED audit events。
- CLI 输出 task status、changed_files、tests_run、risks_found 和 audit event 数量。
- 扩展 execution CLI e2e，覆盖 completed result 从 running 到 reviewing。

## 验证结果

```txt
npm run typecheck
npm run build
npm test
95 passed
```
