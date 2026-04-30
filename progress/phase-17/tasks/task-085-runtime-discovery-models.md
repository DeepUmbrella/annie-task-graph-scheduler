# T085 Runtime Discovery Models

## 状态

`done`

## 目标

定义 runtime discovery 和 candidate node 的核心模型。

## 范围

- 新增 `src/runtime_discovery/*`。
- 定义 `RuntimeCandidate`。
- 定义 `CandidateNode`。
- 定义 `RuntimeDiscoverySnapshot`。
- 补充模型 normalization 和 validation 测试。

## 验收标准

- 可表达 OpenClaw runtime available / unavailable。
- 可表达从 runtime 发现的 candidate node。
- candidate node 不包含 granted actions。
- candidate node 不写入 Node Registry。

## 关联代码

- `src/runtime_discovery/*`
- `tests/runtime_discovery.test.ts`

## 实施记录

- 新增 `RuntimeCandidate`。
- 新增 `CandidateNode`。
- 新增 `RuntimeDiscoverySnapshot`。
- 支持 available / unavailable runtime metadata。
- CandidateNode 只包含 hints、declared capabilities 和 requested actions。
- CandidateNode 不包含 `granted_actions`，避免 discovery 自动获得权限。

## 验证

- `npm run typecheck` passed.
- `npm run build` passed.
- `node --test dist/tests/runtime_discovery.test.js` passed.
