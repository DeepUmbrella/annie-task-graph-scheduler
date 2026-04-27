# T025 Template Instantiation

## 状态

`done`

## 目标

从模板实例化为合法 Plan，支持 overrides。

## 范围

- 在 `src/validation/plan_loader.ts` 新增 `instantiateTemplate()`
- 支持 plan_id 覆盖、task overrides、execution_policy_overrides
- 内部调用 loadPlan() 做 DAG 验证

## 验收标准

- instantiateTemplate 返回 LoadedPlan。
- overrides 可覆盖 task 字段。
- execution_policy_overrides 可覆盖策略。
