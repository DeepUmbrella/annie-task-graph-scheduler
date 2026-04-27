# T019 Wave Progress Projection

## 状态

`todo`

## 目标

生成 Wave 执行进度数据，帮助用户理解每一波任务的执行状态与 ReviewGate 结果。

## 范围

- 输出 wave 列表。
- 每个 wave 包含 task ids、status、started_at、completed_at、review。
- 汇总 wave completion ratio。
- 标记当前 wave。
- 暴露 skipped ready tasks 和 scheduler decision 摘要。

## 验收标准

- 可以区分 pending / running / reviewing / done / failed wave。
- 当前 wave 可被识别。
- ReviewGate 失败原因可显示。
- skipped ready tasks 可显示。

## 关联代码

- `src/models/wave.ts`
- `src/scheduler/scheduler.ts`
- `src/visualization/*`
- `tests/visualization.test.ts`

