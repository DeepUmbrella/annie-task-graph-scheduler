# Phase 04 Plan: Task Template System

## Context

Phase 01-03 已完成调度内核和可视化投影。Phase 04 的目标是提供通用的任务模板系统，让用户可以从预定义模板快速创建 plan，也可以自定义和扩展模板。Annie Memory 和用户偏好由 Annie 自身管理，不在本 phase 范围内。

## Tasks

### T023 Template 模型定义
- 新增 `src/models/template.ts`
- 定义 `TaskTemplate` 接口：`id`, `name`, `description`, `tasks: PlanTaskInput[]`, `execution_policy: ExecutionPolicyInput`, `tags: string[]`, `version: number`, `created_at: string`
- 定义 `TemplateRegistry` 接口：注册、查找、列举模板的能力
- 导出自 `src/models/index.ts`

### T024 内置模板与注册机制
- 新增 `src/templates/` 目录
- `src/templates/registry.ts`：实现 `TemplateRegistry`，支持 `register()` / `get()` / `list()` / `findByTag()`
- `src/templates/builtins/`：提供 3 个内置示例模板
  - `api_design_implement_test.ts`：API 设计→实现→测试→文档（4 task 单链）
  - `parallel_frontend_backend.ts`：前端/后端并行开发→集成测试（5 task 含并行）
  - `full_stack_review.ts`：设计→前端/后端/文档并行→集成测试→Review（7 task 含并行+review）
- `src/templates/index.ts`：导出 registry 和 builtins

### T025 从模板创建 Plan
- 在 `src/validation/plan_loader.ts` 中新增 `instantiateTemplate(template, options)` 函数
- `options` 支持：`plan_id` 覆盖、`overrides`（task 字段覆盖/追加）、`execution_policy_overrides`
- 内部调用 `loadPlan()` 做 DAG 验证
- 返回 `LoadedPlan`，可直接传入 `createInitialWorkflowState()`

### T026 CLI template 命令
- `template list` — 列出所有可用模板
- `template show --template <template_id>` — 显示模板详情
- `template instantiate --template <template_id> --plan-id <plan_id>` — 从模板创建 plan JSON 到 stdout

### T027 Phase 04 验收测试
- 单元测试：模板注册/查找/findByTag
- 单元测试：instantiateTemplate 含 overrides
- 单元测试：CLI template 命令
- 回归测试：Phase 01-03 不受影响
- 更新 progress 和 agent.md

## Key Files

- `src/models/template.ts` — 新增
- `src/models/task.ts` — 复用 `PlanTaskInput`
- `src/models/plan.ts` — 复用 `ExecutionPolicyInput`
- `src/templates/registry.ts` — 新增
- `src/templates/builtins/*.ts` — 新增
- `src/templates/index.ts` — 新增
- `src/validation/plan_loader.ts` — 扩展
- `src/cli.ts` — 扩展
- `tests/template.test.ts` — 新增
- `tests/e2e_template.test.ts` — 新增

## Verification

```
npm run typecheck
npm run build
npm test
```

验证模板可注册、查找、实例化为合法 plan、CLI 可输出。
