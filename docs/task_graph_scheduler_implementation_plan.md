# Annie TaskGraphScheduler 实现计划

## 1. 文档目标

本文基于 `Annie TaskGraphScheduler PRD v0.1`，将 Phase 1 MVP 拆解为可执行的工程实现计划。

Phase 1 的实现重点不是让 Agent 真正自动完成所有代码修改，而是先交付一个本地可运行、可恢复、可审计的调度内核：

```txt
Task DAG 输入
  -> DAG 校验
  -> ready task 计算
  -> wave 生成
  -> worker 分配记录
  -> 结果收集
  -> Review Gate
  -> 状态持久化与恢复
```

OpenClaw 在 Phase 1 中作为传输适配层接入，Annie 自己维护任务状态、消息协议、审计日志和调度决策。

## 2. MVP 实现边界

### 2.1 Phase 1 必做

1. 定义 Task DAG、Execution Policy、Task State、Wave、Worker Assignment、Message、Audit Event 的数据模型。
2. 实现 PlanLoader，读取 `WritingPlansWorkflow` 输出的 DAG 计划。
3. 实现 DagValidator，校验计划格式、任务引用、循环依赖和重复任务 ID。
4. 实现 DependencyResolver，计算 `pending`、`ready`、`blocked` 状态。
5. 实现 Scheduler，按依赖、并发上限、Agent 上限、风险和文件冲突生成 wave。
6. 实现 WorkerPool 的最小分配能力，记录任务分配，不要求真实执行代码修改。
7. 实现 ResultCollector，解析 worker 返回的结构化结果。
8. 实现 ReviewGate，汇总 wave 结果并决定是否进入下一 wave。
9. 实现 StateStore，本地持久化 workflow state、wave state、task state、audit log。
10. 实现 RecoveryManager，支持中断后读取状态并恢复调度。
11. 实现 MessageBus、MailboxStore、核心消息 schema、ACK 和投递重试。
12. 提供一组 CLI 或服务入口用于加载计划、生成 wave、提交结果、恢复状态和查看状态。
13. 提供单元测试与端到端样例，覆盖 PRD 验收标准。

### 2.2 Phase 1 不做

1. 不实现 UI 看板。
2. 不实现复杂资源调度。
3. 不实现分布式锁。
4. 不实现跨项目任务队列。
5. 不允许 Agent 点对点直接修改全局任务状态。
6. 不依赖 OpenClaw 原始聊天记录作为任务状态来源。

## 3. 推荐目录结构

```txt
annie-task-graph-scheduler/
├── docs/
│   ├── annie_task_graph_scheduler_prd (1).md
│   └── task_graph_scheduler_implementation_plan.md
├── src/
│   ├── index.ts
│   ├── cli.ts
│   ├── models/
│   │   ├── plan.ts
│   │   ├── task.ts
│   │   ├── wave.ts
│   │   ├── message.ts
│   │   └── audit.ts
│   ├── validation/
│   │   └── dag_validator.ts
│   ├── scheduler/
│   │   ├── dependency_resolver.ts
│   │   ├── conflict_detector.ts
│   │   └── scheduler.ts
│   ├── execution/
│   │   ├── worker_pool.ts
│   │   ├── result_collector.ts
│   │   └── review_gate.ts
│   ├── communication/
│   │   ├── message_bus.ts
│   │   ├── mailbox_store.ts
│   │   ├── protocol_validator.ts
│   │   └── openclaw_adapter.ts
│   ├── storage/
│   │   ├── state_store.ts
│   │   └── recovery_manager.ts
│   └── errors.ts
├── tests/
│   ├── fixtures/
│   ├── dag_validator.test.ts
│   ├── dependency_resolver.test.ts
│   ├── scheduler.test.ts
│   ├── state_store.test.ts
│   ├── message_bus.test.ts
│   └── e2e_mvp_flow.test.ts
└── package.json
```

如果 Annie 主项目已经有现成语言栈和模块规范，应优先迁移到主项目约定。若当前仓库独立实现，建议用 TypeScript + Node.js，因为 DAG、JSON schema、本地文件持久化和 CLI 测试都比较直接。

## 4. 数据模型设计

### 4.1 Plan

字段：

- `plan_id`
- `plan_type: "dag"`
- `execution_policy`
- `tasks`

关键约束：

- `plan_type` 必须是 `dag`。
- `tasks` 不允许为空。
- `task.id` 在同一 plan 内唯一。
- `depends_on` 只能引用同一 plan 内存在的任务。

### 4.2 Task

字段：

- `id`
- `title`
- `description`
- `depends_on`
- `status`
- `can_parallel`
- `risk`
- `expected_files`
- `changed_files`
- `preferred_agent`
- `assigned_to`
- `retry_count`
- `created_at`
- `started_at`
- `completed_at`
- `blocked_reason`

状态枚举：

```txt
pending | ready | running | reviewing | done | failed | blocked | cancelled
```

状态流转约束：

- `pending -> ready -> running -> reviewing -> done`
- `running -> failed`
- `failed -> ready` 只能通过 retry 记录触发。
- `failed -> done` 只能通过 manual override 记录触发。
- 下游因上游失败进入 `blocked`。

### 4.3 Wave

字段：

- `id`
- `tasks`
- `status`
- `started_at`
- `completed_at`
- `review`
- `reason`
- `skipped_ready_tasks`

`skipped_ready_tasks` 用于解释 ready 任务未进入当前 wave 的原因，例如并发上限、文件冲突、高风险并发限制或 Agent 不可用。

### 4.4 Message

字段：

- `message_id`
- `workflow_id`
- `task_id`
- `wave_id`
- `from`
- `to`
- `type`
- `priority`
- `requires_ack`
- `status`
- `delivery_attempts`
- `created_at`
- `acknowledged_at`
- `processed_at`
- `payload`

Phase 1 支持消息类型：

```txt
TASK_ASSIGNED
TASK_STARTED
TASK_PROGRESS
TASK_COMPLETED
TASK_FAILED
HELP_REQUESTED
ANSWER_PROVIDED
REVIEW_REQUESTED
REVIEW_COMMENT
BLOCKER_REPORTED
APPROVAL_REQUIRED
```

## 5. 核心模块实现计划

### 5.1 PlanLoader

职责：

- 从文件或上游 workflow 输出读取 JSON plan。
- 标准化默认字段，例如 `can_parallel`、`risk`、`expected_files`。
- 生成初始 workflow state。

输入：

```txt
plan.json
```

输出：

```txt
WorkflowState
```

验收：

- 合法 plan 可以被加载。
- 非 JSON 或缺少关键字段时返回结构化错误。

### 5.2 DagValidator

职责：

- 校验 plan 类型。
- 校验任务 ID 唯一。
- 校验依赖引用存在。
- 校验 DAG 无环。
- 输出拓扑排序结果，供调度器复用。

实现建议：

- 使用 DFS 或 Kahn 算法检测循环依赖。
- 错误中返回造成问题的任务 ID 和依赖链。

验收：

- 循环依赖被拒绝。
- 缺失依赖被拒绝。
- 重复 ID 被拒绝。

### 5.3 DependencyResolver

职责：

- 根据当前 task state 计算 ready tasks。
- 根据失败任务传播 blocked 状态。
- 保证不合法状态不会被调度。

规则：

- 所有上游为 `done` 时，`pending` 可以变为 `ready`。
- 任一上游为 `failed` 或 `blocked` 时，下游进入 `blocked`。
- `cancelled`、`running`、`reviewing`、`done` 不参与 ready 计算。

验收：

- 无依赖任务可进入 `ready`。
- 上游完成后下游进入 `ready`。
- 上游失败后下游进入 `blocked`。

### 5.4 ConflictDetector

职责：

- 检查候选任务之间的 `expected_files` 是否重叠。
- Review 时检查 `changed_files` 是否出现实际冲突。
- 输出冲突原因。

Phase 1 规则：

- 文件路径精确相同即冲突。
- 若 `same_file_conflict_policy = "serialize"`，冲突任务不能进入同一 wave。
- 先不做 glob、目录级锁或语义级冲突判断。

验收：

- 修改同一文件的 ready 任务会被拆到不同 wave。

### 5.5 Scheduler

职责：

- 读取 ready tasks。
- 按策略生成下一 wave。
- 记录未选任务的原因。

选择顺序建议：

1. 按拓扑顺序排序 ready tasks。
2. 优先选择低风险与中风险任务。
3. 遇到高风险任务时，默认不与另一个高风险任务并发。
4. 遵守 `max_parallel_tasks`。
5. 遵守 `max_agents`。
6. 避免文件冲突。
7. 尽量保留 `preferred_agent` 的可分配性。

输出示例：

```json
{
  "wave_id": "wave_002",
  "tasks": ["T2", "T3", "T5"],
  "parallel": true,
  "reason": "依赖满足，未超过并发上限，expected_files 无冲突。",
  "skipped_ready_tasks": []
}
```

验收：

- wave 不超过并发限制。
- wave 不包含文件冲突任务。
- wave 能解释跳过原因。

### 5.6 WorkerPool

职责：

- 将 wave 任务分配给 worker agent。
- 写入 `assigned_to` 和 assignment audit event。
- 调用 MessageBus 发送 `TASK_ASSIGNED`。

Phase 1 分配策略：

1. 优先使用 `preferred_agent`。
2. 没有 preferred agent 时按任务类型或默认 agent 分配。
3. 同一 worker 同时任务数不超过配置限制。
4. 分配失败时任务回到 `ready`，并写 audit log。

验收：

- 每个 wave task 都有 assignment 记录。
- 分配失败不会让任务卡在 `running`。

### 5.7 ResultCollector

职责：

- 接收 `TASK_COMPLETED` 或 `TASK_FAILED` 消息。
- 校验 result schema。
- 更新 task 的 `changed_files`、`tests_run`、`risks`。
- 将完成任务置为 `reviewing`，等待 ReviewGate。

验收：

- 缺少 `task_id`、`status`、`summary` 的结果被拒绝。
- 失败结果必须包含失败类型和建议处理方式。

### 5.8 ReviewGate

职责：

- 汇总一个 wave 的所有任务结果。
- 检查失败任务、文件冲突、测试信息和风险。
- 输出 review 结果。
- 决定是否允许进入下一 wave。

输出：

```json
{
  "wave_id": "wave_002",
  "status": "passed",
  "completed_tasks": ["T2", "T3", "T5"],
  "failed_tasks": [],
  "conflicts": [],
  "allow_next_wave": true
}
```

验收：

- 每个 wave 完成后必须经过 ReviewGate。
- critical failure 会阻止下一 wave。
- ReviewGate 通过后，`reviewing` 任务变为 `done`。

### 5.9 StateStore

职责：

- 持久化 workflow state。
- 追加 audit log。
- 提供原子状态更新接口。
- 支持按 workflow_id 读取和恢复。

推荐本地文件结构：

```txt
.annie/
└── workflows/
    └── wf_2026_04_26_001/
        ├── state.json
        ├── audit.jsonl
        └── mailboxes/
            ├── orchestrator/
            │   ├── inbox.jsonl
            │   └── outbox.jsonl
            └── backend-agent/
                ├── inbox.jsonl
                └── outbox.jsonl
```

写入要求：

- `state.json` 使用临时文件 + rename 方式写入，降低中断损坏概率。
- `audit.jsonl` 只追加。
- 所有状态变化必须写 audit event。

### 5.10 RecoveryManager

职责：

- 启动时读取 workflow state。
- 检查 `running` 任务是否存在可追踪 session。
- 对丢失 session 的任务执行恢复策略。
- 重新计算 ready tasks。

Phase 1 恢复策略：

- `done` 任务保持完成，不重复执行。
- `reviewing` 任务重新进入 ReviewGate。
- `running` 且 session 丢失的任务标记为 `failed` 或回到 `ready`，由策略控制。
- 恢复动作写 audit log。

## 6. 通讯层实现计划

### 6.1 MessageBus

职责：

- 创建消息。
- 校验消息。
- 写入发送方 outbox 和接收方 inbox。
- 更新消息状态。
- 处理 ACK、重试和过期。

Phase 1 可以使用本地 JSONL mailbox，不需要真实实时队列。

### 6.2 ProtocolValidator

职责：

- 校验消息类型是否合法。
- 校验必填字段。
- 校验消息方向是否允许。
- 阻止 Agent 直接发送会修改全局状态的非法消息。

关键规则：

- `TASK_ASSIGNED` 只能由 orchestrator 发给 agent。
- `TASK_COMPLETED` 和 `TASK_FAILED` 可以由 agent 发给 orchestrator。
- Agent 点对点消息不能改变任务状态。
- 所有任务相关消息必须包含 `workflow_id`、`task_id`、`wave_id`。

### 6.3 OpenClawAdapter

职责：

- 将 Annie Message 转换为 OpenClaw `sessions_spawn` / `sessions_send` 调用。
- 将 OpenClaw session 回复转换为 Annie Message。

Phase 1 建议先实现接口和 mock adapter：

```txt
TransportAdapter
├── MockAdapter
└── OpenClawAdapter
```

这样调度器和消息总线可以先通过单元测试跑通，之后再接真实 OpenClaw。

## 7. CLI 与运行入口

建议提供最小 CLI：

```txt
annie-tgs init --plan plan.json
annie-tgs next-wave --workflow wf_001
annie-tgs dispatch --workflow wf_001 --wave wave_001
annie-tgs submit-result --workflow wf_001 --result result.json
annie-tgs review-wave --workflow wf_001 --wave wave_001
annie-tgs recover --workflow wf_001
annie-tgs status --workflow wf_001
```

端到端 MVP 流程：

1. `init` 读取 plan 并生成 workflow state。
2. `next-wave` 生成第一波任务。
3. `dispatch` 分配 worker 并写消息。
4. `submit-result` 模拟 worker 返回结果。
5. `review-wave` 执行 ReviewGate。
6. 重复 `next-wave`，直到所有任务完成或阻塞。

## 8. 里程碑拆解

### M1：模型与校验

目标：

- 搭建项目基础结构。
- 定义核心类型与 schema。
- 完成 PlanLoader 和 DagValidator。

交付物：

- `Plan`、`Task`、`Wave`、`ExecutionPolicy` 类型。
- DAG 校验单元测试。
- 合法与非法 plan fixtures。

验收：

- 合法 DAG 通过。
- 循环依赖、缺失依赖、重复 ID 被拒绝。

### M2：状态与依赖解析

目标：

- 实现 StateStore、AuditLog、DependencyResolver。
- 支持任务状态流转校验。

交付物：

- 本地 `.annie/workflows/<workflow_id>/state.json`。
- `audit.jsonl` 追加记录。
- ready / blocked 计算测试。

验收：

- 上游完成后下游 ready。
- 上游失败后下游 blocked。
- 非法状态流转被拒绝。

### M3：Wave 调度

目标：

- 实现 ConflictDetector 和 Scheduler。
- 支持并发上限、文件冲突、高风险任务限制。

交付物：

- `generateNextWave(workflowState)`。
- wave skipped reason。
- 调度单元测试。

验收：

- 独立任务能并发。
- 文件冲突任务被拆分。
- wave 不超过 `max_parallel_tasks` 和 `max_agents`。

### M4：Worker 分配与结果收集

目标：

- 实现 WorkerPool、ResultCollector、ReviewGate。
- 支持 worker assignment 与结构化结果处理。

交付物：

- assignment 写入 state。
- result schema 校验。
- review gate 输出。

验收：

- task 从 `ready -> running -> reviewing -> done` 完整流转。
- 失败任务阻止下游任务。
- ReviewGate 失败时不进入下一 wave。

### M5：MessageBus 与 Mailbox

目标：

- 实现本地 JSONL mailbox。
- 支持核心消息类型、ACK、重试。

交付物：

- `MessageBus`。
- `MailboxStore`。
- `ProtocolValidator`。
- mock transport。

验收：

- `TASK_ASSIGNED` 写入 agent inbox。
- `TASK_COMPLETED` 写入 orchestrator inbox 并被处理。
- ACK 超时后最多重试 2 次。

### M6：恢复与端到端验收

目标：

- 实现 RecoveryManager。
- 跑通完整 MVP 样例。

交付物：

- `recover` CLI。
- e2e fixture：T1 -> T2/T3/T5 -> T4 -> T6。
- 失败场景 fixture。

验收：

- 中断后恢复不会重复执行已完成任务。
- running session 丢失会被明确处理。
- 完整样例能生成正确 wave 序列。

## 9. 测试计划

### 9.1 单元测试

覆盖：

- DAG 校验。
- 状态流转。
- ready task 计算。
- 文件冲突检测。
- wave 生成。
- worker 分配。
- result schema 校验。
- message protocol 校验。
- ACK 与重试。

### 9.2 集成测试

场景：

1. 正常执行：`T1 -> T2/T3/T5 -> T4 -> T6`。
2. 循环依赖：`T1 -> T2 -> T1`。
3. 文件冲突：两个 ready 任务修改同一文件。
4. 任务失败：`T3` failed 后 `T4` blocked。
5. ReviewGate 失败：wave 不允许进入下一波。
6. 恢复：`T1` done、`T2` running 后重启。

### 9.3 验收命令建议

```txt
npm test
npm run test:e2e
npm run lint
npm run typecheck
```

实际命令应以项目语言栈为准。

## 10. 风险与应对

| 风险 | 影响 | 应对 |
|---|---|---|
| WritingPlansWorkflow 输出不稳定 | 调度器无法可靠读取 plan | 先定义严格 JSON schema，并在 PlanLoader 层拒绝不合法输入 |
| Agent 返回自然语言结果 | ResultCollector 无法更新状态 | 强制结构化 result schema，不合法结果进入 review |
| 文件冲突预测不完整 | 并发修改仍可能冲突 | Phase 1 使用 expected_files 预防，ReviewGate 再检查 changed_files |
| 状态文件损坏 | 恢复失败 | state 原子写入，audit jsonl 可回放 |
| OpenClaw 集成复杂 | 阻塞调度内核交付 | 先实现 MockAdapter，再接 OpenClawAdapter |
| 状态与消息重复表达 | 出现不一致 | 以 StateStore 为唯一任务状态来源，Message 只作为输入事件 |

## 11. 开发顺序建议

推荐按以下顺序推进：

1. `models` + JSON schema。
2. `PlanLoader` + `DagValidator`。
3. `StateStore` + audit log。
4. `DependencyResolver`。
5. `ConflictDetector` + `Scheduler`。
6. `WorkerPool` + `ResultCollector` + `ReviewGate`。
7. `MessageBus` + `MailboxStore` + `ProtocolValidator`。
8. `RecoveryManager`。
9. CLI。
10. Mock e2e。
11. OpenClawAdapter。

这个顺序可以保证每一步都能单独测试，并且不会过早被真实多 Agent 执行环境拖住。

## 12. Definition of Done

Phase 1 完成时应满足：

1. 可以从一个合法 DAG plan 初始化 workflow。
2. 可以拒绝非法 plan 和循环依赖 plan。
3. 可以按依赖关系生成正确 wave。
4. 可以根据 `max_parallel_tasks`、`max_agents` 和文件冲突限制 wave。
5. 可以记录 worker assignment。
6. 可以接收结构化结果并进入 ReviewGate。
7. 可以处理任务失败并阻塞下游。
8. 可以持久化 state、mailbox 和 audit log。
9. 可以从中断状态恢复。
10. 可以通过 e2e fixture 复现 PRD 中的完整执行过程。

