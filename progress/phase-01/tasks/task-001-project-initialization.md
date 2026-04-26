# T001 Project Initialization

## 状态

`done`

## 目标

根据实现计划完成项目初始化，为 Phase 1 MVP 后续开发提供可编译、可测试、可提交的基础结构。

## 范围

- 初始化 git 仓库。
- 创建 TypeScript + Node.js 项目配置。
- 创建 `src/`、`tests/` 和 fixtures 目录。
- 创建核心模块占位文件。
- 创建 CLI 占位入口。
- 安装 npm 依赖并生成 lockfile。
- 跑通基础 typecheck、build 和 test。
- 创建初始提交。

## 已完成

- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `.gitignore`
- `README.md`
- `src/models/*`
- `src/scheduler/*`
- `src/execution/*`
- `src/communication/*`
- `src/storage/*`
- `tests/*.test.ts`
- `tests/fixtures/valid_plan.json`
- `tests/fixtures/cyclic_plan.json`

## 验证

```txt
npm run typecheck
npm run build
npm test
```

全部通过。

## 提交

`01aff57 chore: initialize task graph scheduler project`

