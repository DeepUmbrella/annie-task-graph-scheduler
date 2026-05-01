# T123 Result Intake Model

## 状态

`todo`

## 目标

定义 Agent Result Intake 的输入、输出和 decision model。

## 范围

- 新增 result intake input / result 类型。
- 定义 sender node、workflow、wave、task 字段。
- 复用 worker task result schema。

## 验收标准

- 类型可被 service、endpoint、CLI 复用。
- 能表达 accepted / rejected result intake decision。

## 关联代码

- `src/result_intake/model.ts`
- `src/result_intake/index.ts`
