# T086 Runtime Discovery Store

## 状态

`done`

## 目标

实现 runtime discovery snapshot 的本地持久化。

## 范围

- 使用 `.annie/discovery/runtime-candidates.json`。
- 支持保存 snapshot。
- 支持读取 candidate node list。
- 支持文件不存在时返回 empty snapshot。

## 验收标准

- discovery 文件不存在时返回空 snapshot。
- 保存后可重新读取。
- 保存 candidate 不影响 `.annie/nodes/registry.json`。

## 关联代码

- `src/runtime_discovery/store.ts`
- `tests/runtime_discovery.test.ts`

## 实施记录

- 新增 `createRuntimeDiscoveryStore(rootDir)`。
- 新增 `.annie/discovery/runtime-candidates.json` 持久化路径。
- discovery 文件不存在时返回 empty snapshot。
- 保存 discovery snapshot 时复用模型层 normalization。
- 读取 candidates 不触碰 Node Registry。

## 验证

- `npm run typecheck` passed.
- `npm run build` passed.
- `node --test dist/tests/runtime_discovery.test.js` passed.
