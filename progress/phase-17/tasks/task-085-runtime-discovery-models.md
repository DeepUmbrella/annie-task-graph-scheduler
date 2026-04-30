# T085 Runtime Discovery Models

## 状态

`todo`

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
