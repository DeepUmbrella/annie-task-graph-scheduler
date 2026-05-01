# T090 Registration Interview Template

## 状态

`done`

## 目标

从 CandidateNode 生成 node registration interview request。

## 范围

- 新增 `src/node_registration_interview/*`。
- 定义 `NodeRegistrationInterviewRequest`。
- 生成稳定 prompt。
- 要求 candidate 回复 `node-registration.v1` JSON。

## 验收标准

- request 包含 candidate identity。
- request 包含 required schema version。
- request 明确 requested actions 不等于 granted actions。

## 关联代码

- `src/node_registration_interview/*`
- `tests/node_registration_interview.test.ts`

## 实施记录

- 新增 `NodeRegistrationInterviewRequest`。
- 新增 `createNodeRegistrationInterviewRequest(candidate)`。
- 生成稳定 prompt，要求回复 `node-registration.v1` JSON。
- prompt 明确 requested actions 不等于 granted actions。

## 验证

- `npm run typecheck` passed.
- `npm run build` passed.
- `node --test dist/tests/node_registration_interview.test.js` passed.
