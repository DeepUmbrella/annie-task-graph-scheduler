# T003 State Store And Dependency Resolver

## 状态

`todo`

## 目标

完成 M2：状态存储与依赖解析。

## 范围

- 实现 WorkflowState 初始化。
- 实现 StateStore 本地持久化。
- 实现 audit log 追加。
- 实现任务状态流转校验。
- 实现 DependencyResolver。
- 支持 ready / blocked 计算。

## 验收标准

- state 写入 `.annie/workflows/<workflow_id>/state.json`。
- audit 写入 `.annie/workflows/<workflow_id>/audit.jsonl`。
- 所有任务状态变化都有 audit event。
- 无依赖任务可进入 `ready`。
- 上游完成后下游进入 `ready`。
- 上游失败后下游进入 `blocked`。
- 非法状态流转被拒绝。

## 关联代码

- `src/storage/state_store.ts`
- `src/scheduler/dependency_resolver.ts`
- `tests/state_store.test.ts`
- `tests/dependency_resolver.test.ts`

