# T080 Node Registry Models

## 状态

`done`

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

## 实施记录

- 新增 runtime-agnostic node registry 核心模型。
- 新增 `NodeRegistrationProposal` normalization。
- 支持 individual node、team node 和单成员 team。
- 校验 team composition 只能指向 team node。
- 校验 team lead 必须属于 team members。
- 校验 team member 必须是已注册 node 或同 proposal 内 node。

## 验证

- `npm run typecheck` passed.
- `npm run build` passed.
- `node --test dist/tests/node_registry.test.js` passed.
