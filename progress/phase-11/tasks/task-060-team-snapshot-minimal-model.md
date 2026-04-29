# T060 Team Snapshot Minimal Model

## 状态

`todo`

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
