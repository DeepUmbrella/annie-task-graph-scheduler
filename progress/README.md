# Project Progress

本目录用于记录 Annie TaskGraphScheduler 的项目进度。

细粒度任务进度写在 `progress/`。跨客户端交接规则、当前大阶段状态和协作注意事项写在根目录 `agent.md`。

## 目录约定

```txt
progress/
└── phase-XX/
    ├── phase-summary.md
    └── tasks/
        ├── task-001-xxx.md
        └── task-002-xxx.md
```

## 状态约定

| 状态 | 含义 |
|---|---|
| todo | 尚未开始 |
| in_progress | 正在进行 |
| blocked | 被依赖、决策或环境阻塞 |
| review | 已完成实现，等待审查或验证 |
| done | 已完成并验证 |

## 当前阶段

- [Phase 01 MVP](./phase-01/phase-summary.md) - done
- [Phase 02 Enhanced Scheduling](./phase-02/phase-summary.md) - done
- [Phase 03 Visualization](./phase-03/phase-summary.md) - done
- [Phase 04 Task Templates](./phase-04/phase-summary.md) - done
- [Phase 05 Cross-project Scheduling](./phase-05/phase-summary.md) - done
- [Phase 06 Execution CLI Orchestration](./phase-06/phase-summary.md) - done
- [Phase 07 Long-term Memory Integration Boundary](./phase-07/phase-summary.md) - todo

当前下一阶段：

Phase 07 Long-term Memory Integration Boundary 正在推进。T042-T043 已完成，下一步进入 T044。

## 更新规则

每个 task 推进时：

1. 在对应 `phase-summary.md` 中把 task 状态改为 `in_progress`。
2. 在对应 task 文件中同步状态。
3. 完成实现后运行验证命令。
4. 将 task 状态改为 `done`。
5. 在 task 文件写入完成记录和验证结果。
6. 提交代码和进度文档。

每个 phase 完成时：

1. 将 `phase-summary.md` 的阶段状态改为 `done`。
2. 确认该 phase 所有 task 都是 `done`。
3. 更新 `agent.md` 中的 phase-level 状态和验证基线。

## 与 agent.md 的分工

`progress/` 记录：

- phase 列表
- task 列表
- task 状态
- task 完成记录
- task 验证结果

`agent.md` 记录：

- 当前大阶段状态
- 跨编辑器 / Agent 的交接规则
- 架构地图
- 开发和验证基线
- 什么时候必须停下来询问用户

不要因为普通小任务完成而更新 `agent.md`。只有 phase 开始/结束、验证基线变化、架构规则变化或协作规则变化时才更新。

## 验证命令

```txt
npm run typecheck
npm run build
npm test
```

当前基线：

```txt
103 passed
```
