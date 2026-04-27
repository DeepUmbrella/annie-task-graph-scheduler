# T016 Visualization Model

## 状态

`todo`

## 目标

定义 Phase 03 可视化数据模型和模块边界，为 Workflow 看板、DAG 图、Wave 进度和失败追踪提供统一 view model。

## 范围

- 新增 `src/visualization/` 模块目录。
- 定义 visualization view model 类型。
- 定义 workflow summary、task node、dependency edge、wave view、failure view。
- 定义从 `WorkflowState` 到 visualization model 的 projection 函数边界。
- 不绑定具体 UI 技术栈。

## 验收标准

- 类型可以表达 Phase 03 所需所有视图。
- projection 函数可以接受 `WorkflowState`。
- 旧代码不需要了解 visualization 模块。
- 单元测试覆盖基础空状态和完整 workflow 状态。

## 关联代码

- `src/models/workflow.ts`
- `src/visualization/*`
- `tests/visualization.test.ts`

