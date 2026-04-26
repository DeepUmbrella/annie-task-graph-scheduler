# T002 Models And DAG Validation

## 状态

`todo`

## 目标

完成 M1：模型与校验。

## 范围

- 完善 `Plan`、`Task`、`Wave`、`ExecutionPolicy` 类型。
- 实现 PlanLoader。
- 实现 DagValidator。
- 校验 plan 类型、任务 ID 唯一性、依赖引用和循环依赖。
- 输出可复用的拓扑排序结果。
- 补充合法与非法 plan fixtures。

## 验收标准

- 合法 DAG 可以通过校验。
- 非 `dag` 类型 plan 被拒绝。
- 空任务列表被拒绝。
- 重复 task ID 被拒绝。
- 缺失依赖引用被拒绝。
- 循环依赖被拒绝，并返回问题任务或依赖链。
- 单元测试覆盖以上场景。

## 关联代码

- `src/models/*`
- `src/validation/dag_validator.ts`
- `tests/dag_validator.test.ts`
- `tests/fixtures/*`

