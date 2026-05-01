# T091 Proposal Reply Parser

## 状态

`todo`

## 目标

从 runtime reply 中解析 `NodeRegistrationProposal`。

## 范围

- 支持 object reply。
- 支持 text/content/reply/message 字段。
- 支持 fenced JSON。
- 使用 registry model validation。

## 验收标准

- 有效 JSON 可解析。
- fenced JSON 可解析。
- 无效 JSON 返回结构化错误。
- schema 错误返回结构化错误。

## 关联代码

- `src/node_registration_interview/parser.ts`
- `tests/node_registration_interview.test.ts`
