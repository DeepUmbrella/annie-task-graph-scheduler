# T030 Global Queue Builder

## 状态

`done`

## 目标

从多个 workflow state 构建全局 ready task 队列。

## 范围

- 新增 `src/projects/global_queue.ts`。
- 输入多个 `ProjectWorkflowRef + WorkflowState`。
- 只收集 `ready` tasks。
- 队列项包含 project id、workflow id、task id、risk score、priority、preferred agent、required capabilities。
- 支持稳定排序。

## 验收标准

- pending / running / reviewing / done / failed / blocked 不进入队列。
- ready task 进入队列。
- 队列项包含跨项目定位信息。
- 输出稳定，便于测试和可视化。

## 关联代码

- `src/projects/global_queue.ts`
- `src/scheduler/risk_scorer.ts`
- `tests/cross_project_scheduler.test.ts`

## 完成记录

- 新增 `src/projects/global_queue.ts`。
- 实现 `buildGlobalTaskQueue`，从多个 project/workflow/state 输入中收集 ready tasks。
- 队列项包含 project、workflow、task、priority、risk、risk_score、preferred_agent、required_capabilities。
- 非 ready task 会进入 skipped 列表，便于后续可视化和调度解释。
- 输出按 project_id / workflow_id / task_id 稳定排序。
- 对 project/workflow/state 不匹配返回 TaskGraphSchedulerError 结构化错误。

## 验证结果

```txt
npm run typecheck
npm run build
npm test
83 passed
```
