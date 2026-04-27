# T023 Template Model

## 状态

`todo`

## 目标

定义 TaskTemplate 模型和 TemplateRegistry 接口。

## 范围

- 新增 `src/models/template.ts`
- 定义 `TaskTemplate` 接口
- 定义 `TemplateRegistry` 接口
- 导出自 `src/models/index.ts`

## 验收标准

- TaskTemplate 接口包含 id、name、description、tasks、execution_policy、tags、version、created_at。
- TemplateRegistry 接口包含 register、get、list、findByTag。
