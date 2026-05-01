# T111 Schedule Next Wave Service

## 状态

`done`

## 目标

实现通过 workflow id 显式生成下一波 wave 的 service。

## 范围

- 从 StateStore 加载 workflow state。
- 复用现有 scheduler。
- 保存生成 wave 后的 state。
- 写 scheduling audit event。
- 处理 active wave、no-ready-task、completed workflow。

## 验收标准

- Bootstrapped workflow 可生成 first wave。
- 已存在 active wave 时返回 idempotent decision。
- no-ready / completed 状态不破坏 state。

## 关联代码

- `src/workflow_scheduling/schedule_next_wave.ts`
- `src/storage/state_store.ts`
- `src/scheduler/scheduler.ts`

## 完成记录

- 新增 `scheduleNextWorkflowWave` service。
- 支持 active wave idempotency。
- 支持 completed / failed / no-ready decision。
- 复用 `resolveDependencies` 和 `generateNextWave`。
- 生成 wave 时只设置 `current_wave`，不 dispatch、不修改 task 为 running。
- 写入 scheduling audit event 和依赖状态变更 audit event。

## 验证结果

```txt
npm run typecheck: pass
```
