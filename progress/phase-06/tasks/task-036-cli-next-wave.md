# T036 CLI Next Wave

## 状态

`done`

## 目标

实现 `next-wave --workflow <workflow_id>`，根据当前 workflow state 解析依赖并生成下一 wave。

## 范围

- 扩展 `src/cli.ts`。
- 加载 workflow state。
- 调用 `resolveDependencies`。
- 调用 `generateNextWave`。
- 保存依赖解析后的 state 和新增 wave。
- 输出 ready task、wave、skipped reason、decision JSON。

## 验收标准

- pending task 在依赖满足后进入 ready。
- 生成的 wave 被写入 state。
- 无 ready task 时输出 null wave，不破坏 state。
- skipped reason 可从 CLI JSON 中观察。

## 关联代码

- `src/cli.ts`
- `src/scheduler/dependency_resolver.ts`
- `src/scheduler/scheduler.ts`
- `tests/e2e_execution_cli.test.ts`

## 完成记录

- 新增 `next-wave --workflow <workflow_id>` CLI。
- 命令会加载 workflow state，执行 `resolveDependencies` 和 `generateNextWave`。
- 生成 wave 时会将新增 wave 持久化到 state。
- 无 wave 时仍保存依赖解析后的 state，保留 blocked 等状态变化。
- CLI 输出 ready task、blocked task、status changes、wave、skipped reason 和 scheduler decision。
- 扩展 execution CLI e2e，覆盖依赖解析、wave 持久化和 file conflict skipped reason。

## 验证结果

```txt
npm run typecheck
npm run build
npm test
93 passed
```
