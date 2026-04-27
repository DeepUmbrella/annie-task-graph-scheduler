# T033 CLI Project / Queue Commands

## 状态

`todo`

## 目标

提供 project registry 和 global queue 的 CLI JSON 输出，便于外部 UI 或 Annie Orchestrator 调用。

## 范围

- 扩展 `src/cli.ts`。
- `project register`
- `project list`
- `project show`
- `queue build`
- `queue plan`
- 输出 JSON。

## 验收标准

- CLI 可注册项目。
- CLI 可列出项目。
- CLI 可读取 workflow state 并构建 queue。
- CLI 可输出 dispatch plan。
- 错误时输出结构化错误。

## 关联代码

- `src/cli.ts`
- `src/projects/*`
- `tests/e2e_phase_05.test.ts`

