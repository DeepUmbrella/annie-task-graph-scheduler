# T111 Schedule Next Wave Service

## 状态

`todo`

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
