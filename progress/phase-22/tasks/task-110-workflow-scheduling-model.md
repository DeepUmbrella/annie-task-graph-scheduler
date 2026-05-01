# T110 Workflow Scheduling Model

## 状态

`todo`

## 目标

定义 next-wave scheduling 的输入、输出和 decision model。

## 范围

- 新增 scheduling input / result 类型。
- 定义 decision status 和 reason。
- 保持 runtime-neutral，不引入 OpenClaw 字段。

## 验收标准

- 类型可被 service、endpoint、CLI 复用。
- 能表达 scheduled / active_wave / no_ready_tasks / completed / failed 等结果。

## 关联代码

- `src/workflow_scheduling/model.ts`
- `src/workflow_scheduling/index.ts`
