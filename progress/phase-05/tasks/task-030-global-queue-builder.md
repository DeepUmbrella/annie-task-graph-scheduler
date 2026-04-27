# T030 Global Queue Builder

## 状态

`todo`

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

