# T124 Result Intake Service

## 状态

`done`

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

## 完成记录

- 新增 `intakeAgentResult` service。
- 校验 sender 必须等于 task `assigned_to`。
- 支持 `assigned` task 隐式变为 `running` 后交给 ResultCollector。
- 复用 ResultCollector 处理 completed / failed / retry。
- 保存 workflow state 并写 intake / status / collection audit events。

## 验证结果

```txt
npm run typecheck: pass
```
