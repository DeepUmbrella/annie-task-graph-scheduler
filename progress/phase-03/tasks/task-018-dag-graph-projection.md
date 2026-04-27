# T018 DAG Graph Projection

## 状态

`todo`

## 目标

将任务依赖转为 DAG 图展示数据。

## 范围

- 生成 task nodes。
- 生成 dependency edges。
- 节点包含 task id、title、status、risk score、assigned agent。
- 边包含 source / target 和状态。
- 支持 blocked / failed 节点高亮字段。

## 验收标准

- 无依赖任务可显示为独立节点。
- 依赖关系正确生成 edges。
- failed / blocked 状态可被 UI 识别。
- 输出稳定排序，便于测试和 diff。

## 关联代码

- `src/visualization/*`
- `src/scheduler/risk_scorer.ts`
- `tests/visualization.test.ts`

