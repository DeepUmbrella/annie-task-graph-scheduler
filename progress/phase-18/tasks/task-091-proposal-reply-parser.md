# T091 Proposal Reply Parser

## 状态

`done`

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

## 实施记录

- 新增 `parseNodeRegistrationProposalReply`。
- 支持直接 object proposal。
- 支持 `proposal` / `content` / `reply` / `message` / `text` 字段。
- 支持 fenced JSON。
- 解析后复用 `normalizeNodeRegistrationProposal` 做 schema validation。

## 验证

- `npm run typecheck` passed.
- `npm run build` passed.
- `node --test dist/tests/node_registration_interview.test.js` passed.
