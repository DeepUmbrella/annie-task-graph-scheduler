# T124 Result Intake Service

## 状态

`todo`

## 目标

实现 runtime-neutral task result intake service。

## 范围

- 加载 workflow state。
- 校验 sender node 等于 task assigned node。
- 支持 `assigned` task 隐式变 `running` 后收集结果。
- 调用 ResultCollector。
- 保存 state 和 audit。

## 验收标准

- Assigned task completed result 进入 reviewing。
- Failed result 遵循 retry policy。
- Unauthorized sender 被拒绝。

## 关联代码

- `src/result_intake/intake_result.ts`
- `src/execution/result_collector.ts`
- `src/storage/state_store.ts`
