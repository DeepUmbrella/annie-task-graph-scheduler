# T080 Node Registry Models

## 状态

`todo`

## 目标

定义 runtime-agnostic node registry 的核心模型。

## 范围

- 新增 `src/node_registry/*`。
- 定义 `RegisteredNode`。
- 定义 `TeamComposition`。
- 定义 `NodeRegistrationProposal`。
- 定义 `TeamContext`。
- 补充模型和 schema validation 测试。

## 验收标准

- individual node 可通过 proposal 校验。
- team node 可通过 proposal 校验。
- 单成员 team 可通过 proposal 校验。
- team member 缺少对应 registered node 时失败。

## 关联代码

- `src/node_registry/*`
- `tests/node_registry.test.ts`
