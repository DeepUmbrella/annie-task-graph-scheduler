# T036 CLI Next Wave

## 状态

`todo`

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
