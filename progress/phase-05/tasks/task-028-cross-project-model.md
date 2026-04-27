# T028 Cross-project Model

## 状态

`done`

## 目标

定义跨项目调度所需的基础模型，为 Project Registry、Global Queue 和 Cross-project Scheduler 提供稳定类型。

## 范围

- 新增 `src/models/project.ts`。
- 定义 `ProjectRef`。
- 定义 `ProjectWorkflowRef`。
- 定义 `GlobalTaskQueueItem`。
- 定义 `ProjectPriority` / `UserPriority`。
- 定义 `GlobalAgentRuntimeState`。
- 从 `src/index.ts` 导出。

## 验收标准

- 类型能表达 project、workflow、task 三层关系。
- 队列项能携带 priority、risk、agent requirement。
- 不影响现有 `WorkflowState`。
- 单元测试可构造合法跨项目模型。

## 关联代码

- `src/models/project.ts`
- `src/index.ts`
- `tests/cross_project_scheduler.test.ts`

## 完成记录

- 新增 `src/models/project.ts`，定义 ProjectRef、ProjectWorkflowRef、GlobalTaskQueueItem、ProjectPriority、UserPriority、GlobalAgentRuntimeState。
- 从 `src/index.ts` 导出跨项目模型。
- 新增 `tests/project_model.test.ts`，覆盖跨项目模型构造与 priority 常量导出。

## 验证结果

```txt
npm run typecheck
npm run build
npm test
75 passed
```
