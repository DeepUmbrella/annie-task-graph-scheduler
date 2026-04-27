# T017 Workflow Board Projection

## 状态

`todo`

## 目标

生成 Workflow 看板所需的数据，包括整体状态、任务状态统计、当前 wave、Agent 负载摘要和最近风险提示。

## 范围

- 生成 workflow summary。
- 汇总 task status counts。
- 汇总 wave status counts。
- 汇总 agent load summary。
- 输出当前阻塞原因摘要。

## 验收标准

- 可以区分 pending / running / reviewing / done / failed / blocked。
- 可以展示 current wave。
- 可以展示 Agent active task 数。
- 可以展示 blocked / failed 摘要。

## 关联代码

- `src/visualization/*`
- `tests/visualization.test.ts`

