# T060 Team Snapshot Minimal Model

## 状态

`done`

## 目标

定义最小 team snapshot 模型，为 planner handoff 提供团队成员和 controller agent。

## 范围

- 新增 `src/team/*`。
- 定义 `TeamSnapshot`、`TeamAgent`、`TeamPermissions`。
- 提供默认本地 team。
- 确保 `team-lead-agent` 是 `agents[]` 成员。

## 验收标准

- 默认 team 包含 controller agent。
- controller agent 有 planning / create_task / assign_task 权限。
- 模型不包含 per-agent collaboration whitelist。

## 关联代码

- `src/team/*`
- `tests/team.test.ts`

## 完成记录

- 新增 `TeamSnapshot`、`TeamAgent`、`TeamPermissions`。
- 新增默认本地 team：`default-dev-team`。
- `team-lead-agent` 作为 controller 存在于 `agents[]`。
- 未引入 per-agent collaboration allowlist。
- 新增同 team peers 查询。

## 验证结果

```txt
npm run typecheck: pass
npm run build: pass
npm test: 128 passed
```
