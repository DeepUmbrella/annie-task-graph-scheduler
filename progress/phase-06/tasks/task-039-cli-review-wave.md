# T039 CLI Review Wave

## 状态

`done`

## 目标

实现 `review-wave --workflow <workflow_id> --wave <wave_id>`，通过 CLI 执行 ReviewGate。

## 范围

- 扩展 `src/cli.ts`。
- 加载 workflow state。
- 查找指定 wave。
- 调用 `reviewWave`。
- 保存 next state。
- 追加 audit events。
- 输出 review JSON。

## 验收标准

- 所有 wave task reviewing 时可以通过 review。
- ReviewGate 通过后任务进入 done。
- ReviewGate 失败时不允许进入下一 wave。
- 文件冲突、失败任务和 blocked reason 可从输出观察。

## 关联代码

- `src/cli.ts`
- `src/execution/review_gate.ts`
- `tests/e2e_execution_cli.test.ts`

## 完成记录

- 新增 `review-wave --workflow <workflow_id> --wave <wave_id>` CLI。
- 命令调用 `reviewWave` 执行 ReviewGate。
- 保存 review 后的 workflow state。
- CLI 侧追加 WAVE_REVIEWED 和 TASK_STATUS_CHANGED audit events。
- CLI 输出 review、state summary 和 audit event 数量。
- 扩展 execution CLI e2e，覆盖 reviewing task 通过 ReviewGate 后进入 done。

## 验证结果

```txt
npm run typecheck
npm run build
npm test
96 passed
```
