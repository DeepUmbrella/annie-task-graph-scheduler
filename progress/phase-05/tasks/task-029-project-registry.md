# T029 Project Registry

## 状态

`todo`

## 目标

实现本地 Project Registry，用于登记多个项目及其 workflow state 位置。

## 范围

- 新增 `src/projects/registry.ts`。
- 支持 register / get / list / update。
- 使用本地 JSON 文件持久化 registry。
- 默认路径位于 `.annie/projects.json`。
- 返回结构化错误。

## 验收标准

- 可以注册项目。
- 可以读取项目。
- 可以列举项目。
- 可以更新项目 priority。
- registry 文件不存在时返回空列表。

## 关联代码

- `src/projects/registry.ts`
- `src/models/project.ts`
- `tests/project_registry.test.ts`

