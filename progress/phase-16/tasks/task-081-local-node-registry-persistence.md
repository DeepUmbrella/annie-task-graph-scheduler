# T081 Local Node Registry Persistence

## 状态

`done`

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

## 实施记录

- 新增 `createNodeRegistry(rootDir)`。
- 新增 `.annie/nodes/registry.json` 持久化路径。
- registry 文件不存在时返回 empty snapshot。
- 注册 proposal 时复用模型层 normalization 和 validation。
- 重复注册同一 node 时保留 `registered_at` 并更新 `updated_at`。
- 使用临时文件加 rename 的方式保存 snapshot。

## 验证

- `npm run typecheck` passed.
- `npm run build` passed.
- `node --test dist/tests/node_registry.test.js` passed.
