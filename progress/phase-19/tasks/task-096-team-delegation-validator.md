# T096 Team Delegation Validator

## 状态

`done`

## 目标

实现 team-scoped delegation validation。

## 范围

- 新增 `src/team_delegation/*`。
- 校验 sender team context。
- 校验 target 是同 team member。
- 校验 action policy。

## 验收标准

- 同 team member delegation 通过。
- sender 非 team member 失败。
- target 非 team member 失败。
- 未授权 action 失败。

## 关联代码

- `src/team_delegation/*`
- `tests/team_delegation.test.ts`

## 实施记录

- 新增 `validateTeamDelegation`。
- 校验 sender 的 team context。
- 校验 target 是同 team member。
- 校验 action policy 允许 `delegate_to_member` + `TASK_ASSIGNED`。

## 验证

- `npm run typecheck` passed.
- `npm run build` passed.
- `node --test dist/tests/team_delegation.test.js` passed.
