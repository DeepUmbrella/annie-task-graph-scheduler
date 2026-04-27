# T031 Cross-project Scheduler

## 状态

`todo`

## 目标

基于 global ready task queue 输出跨项目 dispatch plan。

## 范围

- 新增 `src/projects/cross_project_scheduler.ts`。
- 根据用户优先级、项目优先级、risk score、Agent 负载排序。
- 输出 dispatch plan。
- 不直接修改 workflow state。
- 保留解释字段。

## 验收标准

- 高优先级项目任务优先。
- 高优先级用户任务优先。
- Agent 满载时任务不进入 dispatch plan。
- 输出 skipped reason。
- 不修改输入 state。

## 关联代码

- `src/projects/cross_project_scheduler.ts`
- `src/projects/global_queue.ts`
- `src/projects/agent_pool.ts`
- `tests/cross_project_scheduler.test.ts`

