# T040 Execution CLI E2E

## 状态

`done`

## 目标

新增执行 CLI 端到端测试，证明单 workflow 可以通过 CLI 完成核心执行闭环。

## 范围

- 新增 `tests/e2e_execution_cli.test.ts`。
- 覆盖 `init -> next-wave -> dispatch -> submit-result -> review-wave -> next-wave`。
- 覆盖失败结果阻塞下游。
- 覆盖文件冲突 skipped reason。

## 验收标准

- CLI e2e 可在临时 root 目录中独立运行。
- e2e 不依赖用户机器已有 `.annie` 数据。
- 输出 JSON 可解析。
- Phase 01-05 回归测试继续通过。

## 关联代码

- `tests/e2e_execution_cli.test.ts`
- `src/cli.ts`

## 完成记录

- 扩展 `tests/e2e_execution_cli.test.ts`。
- 覆盖成功路径：`init -> next-wave -> dispatch -> submit-result -> review-wave -> next-wave`。
- 验证首个 wave review 通过后，下游 task 进入下一 wave。
- 覆盖失败路径：非 retryable failure 经过 ReviewGate 后阻塞下游 task。
- 保留 file conflict skipped reason 覆盖。

## 验证结果

```txt
npm run typecheck
npm run build
npm test
98 passed
```
