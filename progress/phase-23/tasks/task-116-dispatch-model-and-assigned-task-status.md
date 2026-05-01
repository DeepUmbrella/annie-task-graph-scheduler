# T116 Dispatch Model And Assigned Task Status

## 状态

`todo`

## 目标

定义 dispatch 输入/输出模型，并引入 task `assigned` 中间态。

## 范围

- 新增 dispatch model。
- 新增 task `assigned` 状态。
- 更新 allowed task status transitions。
- 保持 runtime-neutral。

## 验收标准

- Dispatch model 可被 service、endpoint、CLI 复用。
- Task 可以从 `ready` 进入 `assigned`。
- `assigned` 不等于 `running`。

## 关联代码

- `src/workflow_dispatch/model.ts`
- `src/models/task.ts`
- `src/storage/state_store.ts`
