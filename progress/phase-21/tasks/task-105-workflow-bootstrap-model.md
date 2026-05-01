# T105 Workflow Bootstrap Model

## 状态

`todo`

## 目标

定义 workflow bootstrap input / result。

## 范围

- 新增 `src/workflow_bootstrap/*`。
- 定义 `WorkflowBootstrapInput`。
- 定义 `WorkflowBootstrapResult`。
- 定义 workflow id 生成规则。

## 验收标准

- bootstrap input 可指定 proposal id。
- workflow id 可指定或自动生成。

## 关联代码

- `src/workflow_bootstrap/*`
- `tests/workflow_bootstrap.test.ts`
