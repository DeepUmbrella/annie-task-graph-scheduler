# T024 Builtin Templates

## 状态

`todo`

## 目标

实现模板注册机制和内置示例模板。

## 范围

- `src/templates/registry.ts`：实现 TemplateRegistry
- `src/templates/builtins/`：3 个内置模板
- `src/templates/index.ts`：导出

## 验收标准

- createTemplateRegistry() 返回的 registry 可 register/get/list/findByTag。
- 内置 3 个模板：api-design-implement-test、parallel-frontend-backend、full-stack-review。
