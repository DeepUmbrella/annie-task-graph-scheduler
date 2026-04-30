# T081 Local Node Registry Persistence

## 状态

`todo`

## 目标

实现本地 Node Registry 持久化。

## 范围

- 使用 `.annie/nodes/registry.json`。
- 支持 proposal registration。
- 支持 list snapshot。
- 支持重复注册更新。

## 验收标准

- registry 文件不存在时返回空 snapshot。
- 注册 proposal 后可重新读取。
- 重复注册同 node 更新记录。

## 关联代码

- `src/node_registry/registry.ts`
- `tests/node_registry.test.ts`
