# Annie TaskGraphScheduler PRD

## 1. 文档信息

| 项目 | 内容 |
|---|---|
| 产品名称 | Annie TaskGraphScheduler |
| 所属系统 | Annie Workflow System |
| 文档类型 | PRD |
| 版本 | v0.1 |
| 状态 | Draft |
| 目标阶段 | Phase 1 MVP |

---

## 2. 背景

当前 Annie 工作流系统已经具备大阶段流程的设计思路，例如：

```txt
Brainstorming → Writing Plans → Execution → Review → Delivery
```

这种流程适合表达“阶段顺序”，但不适合表达真实任务执行中的依赖关系。

真实开发任务通常不是简单线性步骤，而是一个任务图：

- 有些任务必须先完成，后续任务才能开始。
- 有些任务互不依赖，可以并发执行。
- 有些任务虽然依赖满足，但会修改同一文件，不能并发。
- 有些任务风险较高，需要人工确认或审查后才能继续。

如果 Annie 仍然按线性步骤执行，会出现以下问题：

1. 独立任务不能并发，效率低。
2. 计划阶段没有表达任务依赖，执行器只能机械按顺序跑。
3. 多 Agent / 多 session 的能力无法充分利用。
4. 任务失败后，下游任务无法精确判断哪些应阻塞、哪些可继续。
5. 无法形成可恢复、可审计、可回放的执行系统。

因此需要设计 `TaskGraphScheduler`，作为 Annie 执行阶段的核心调度模块。

---

## 3. 产品目标

`TaskGraphScheduler` 的目标是：

> 将 `WritingPlansWorkflow` 生成的任务计划从“线性步骤列表”升级为“可调度任务图”，并在执行阶段自动识别可并发任务，按依赖、风险和文件冲突约束进行波次执行。

### 3.1 核心目标

1. 支持基于 DAG 的任务依赖建模。
2. 自动识别当前可执行任务。
3. 支持按 wave 分批并发执行任务。
4. 支持并发限制和文件冲突检测。
5. 支持任务失败后的阻塞、重试和降级。
6. 支持多 Agent / 多 session 派发任务。
7. 支持每一波任务完成后的结果收集与审查。
8. 支持状态持久化，使流程可以恢复。

### 3.2 非目标

Phase 1 不做以下内容：

1. 不做完全自治的无限循环执行。
2. 不做复杂资源调度，例如 CPU、GPU、Token 预算动态分配。
3. 不做跨项目全局任务调度。
4. 不做真正的分布式锁系统。
5. 不做多用户权限系统。
6. 不要求所有 Agent 之间直接通信。
7. 不替代 `BrainstormingWorkflow` 和 `WritingPlansWorkflow`。

---

## 4. 用户与使用场景

### 4.1 主要用户

| 用户 | 需求 |
|---|---|
| 用户本人 | 希望 Annie 能自动执行复杂开发任务，不要所有步骤都串行执行 |
| Annie Orchestrator | 需要根据计划自动调度任务 |
| Developer Agent | 接收具体开发任务并执行 |
| Reviewer Agent | 审查每一波执行结果 |
| Ops Agent | 执行部署、环境、脚本类任务 |

### 4.2 典型场景

#### 场景 1：开发一个新功能

用户提出需求，经过：

```txt
BrainstormingWorkflow → WritingPlansWorkflow
```

生成任务图：

```txt
T1 定义协议
T2 实现服务端 Handler，依赖 T1
T3 实现客户端 UI，依赖 T1
T4 编写联调测试，依赖 T2 + T3
T5 更新文档，依赖 T1
T6 最终 Review，依赖 T4 + T5
```

TaskGraphScheduler 应识别执行波次：

```txt
Wave 1: T1
Wave 2: T2 + T3 + T5
Wave 3: T4
Wave 4: T6
```

#### 场景 2：部分任务失败

如果 `T3 客户端 UI` 失败：

- `T4 联调测试` 应被阻塞。
- `T5 更新文档` 如果已完成，不应回滚。
- `T2 服务端 Handler` 如果完成，不应重复执行。
- Scheduler 应生成失败报告，并决定是否重试、降级或请求用户介入。

#### 场景 3：文件冲突

如果两个任务都可能修改：

```txt
Unity/Assets/Scripts/HotfixView/UI/DlgTeamMain.cs
```

即使它们依赖满足，也不能并发执行，应自动拆到不同 wave。

---

## 5. 整体流程

```txt
User Idea
  ↓
BrainstormingWorkflow
  ↓
Design Spec
  ↓
WritingPlansWorkflow
  ↓
Task DAG
  ↓
ExecutionWorkflow
  ↓
TaskGraphScheduler
  ↓
Parallel Worker Sessions
  ↓
Result Collector
  ↓
Review Gate
  ↓
Next Wave / Delivery
```

---

## 6. 核心概念

### 6.1 Workflow

Workflow 表示一个大阶段流程，例如：

```txt
Brainstorming → Writing Plans → Execution → Review → Delivery
```

Workflow 主要负责阶段推进。

### 6.2 Task DAG

Task DAG 表示一个具体执行计划中的任务依赖图。

它解决的问题是：

```txt
哪些任务必须先做？
哪些任务可以一起做？
哪些任务失败会影响下游？
哪些任务不能并发？
```

### 6.3 Wave

Wave 是一次可控的并发执行批次。

例如：

```txt
Wave 1: T1
Wave 2: T2, T3, T5
Wave 3: T4
Wave 4: T6
```

每个 wave 完成后，系统需要：

1. 收集结果。
2. 检查文件冲突。
3. 执行必要测试。
4. 进入 Review Gate。
5. 决定是否进入下一 wave。

### 6.4 Worker Session

Worker Session 是实际执行任务的 Agent 会话。

在 OpenClaw 中，可以通过类似能力映射：

```txt
sessions_spawn → 创建执行会话
sessions_send  → 分发任务
```

OpenClaw 提供多 session / 多 agent 能力，Annie 的 `TaskGraphScheduler` 负责上层任务图调度。

---

## 7. 功能需求

## 7.1 任务图输入

`WritingPlansWorkflow` 必须输出 DAG 格式任务计划。

### 输入格式示例

```json
{
  "plan_id": "plan_2026_04_26_001",
  "plan_type": "dag",
  "execution_policy": {
    "max_parallel_tasks": 3,
    "max_agents": 3,
    "same_file_conflict_policy": "serialize",
    "review_after_each_wave": true,
    "stop_on_critical_failure": true
  },
  "tasks": [
    {
      "id": "T1",
      "title": "定义消息协议",
      "description": "定义客户端与服务端通信所需的消息协议。",
      "depends_on": [],
      "can_parallel": false,
      "risk": "medium",
      "expected_files": [
        "Unity/Assets/Scripts/Model/Message/TeamMessage.cs"
      ],
      "preferred_agent": "backend-agent"
    },
    {
      "id": "T2",
      "title": "实现服务端 Handler",
      "description": "实现队伍创建请求的服务端处理逻辑。",
      "depends_on": ["T1"],
      "can_parallel": true,
      "risk": "medium",
      "expected_files": [
        "Server/Hotfix/Team/CreateTeamHandler.cs"
      ],
      "preferred_agent": "backend-agent"
    },
    {
      "id": "T3",
      "title": "实现客户端 UI",
      "description": "实现创建队伍按钮和队伍列表刷新逻辑。",
      "depends_on": ["T1"],
      "can_parallel": true,
      "risk": "medium",
      "expected_files": [
        "Unity/Assets/Scripts/HotfixView/UI/DlgTeamMain.cs"
      ],
      "preferred_agent": "frontend-agent"
    }
  ]
}
```

### 验收标准

- 系统可以读取 DAG 任务计划。
- 系统可以识别任务依赖。
- 系统可以拒绝非 DAG 格式的执行计划。
- 如果存在循环依赖，系统必须阻止执行并返回错误。

---

## 7.2 依赖解析

系统需要根据任务状态计算当前 ready tasks。

### 任务可执行条件

一个任务进入 `ready` 状态必须满足：

1. 所有 `depends_on` 任务状态都是 `done`。
2. 当前任务不是 `cancelled`。
3. 当前任务没有被上游失败阻塞。
4. 当前任务没有等待人工确认。
5. 当前任务没有违反并发策略。

### 验收标准

- 上游未完成时，下游任务保持 `pending`。
- 上游完成后，下游任务可以进入 `ready`。
- 上游失败时，下游任务进入 `blocked` 或等待重试策略。
- 多个无依赖任务可以同时进入 `ready`。

---

## 7.3 Wave 生成

系统需要把当前 ready tasks 组织为一个执行 wave。

### Wave 生成规则

1. 只选择 `ready` 状态任务。
2. 不超过 `max_parallel_tasks`。
3. 不超过 `max_agents`。
4. 不能包含文件冲突任务。
5. 高风险任务默认不与其他高风险任务并发。
6. 如任务指定 `preferred_agent`，优先分配给对应 Agent。

### 示例

```json
{
  "wave_id": "wave_002",
  "tasks": ["T2", "T3", "T5"],
  "parallel": true,
  "reason": "这些任务依赖均已满足，且 expected_files 无冲突。"
}
```

### 验收标准

- Scheduler 能生成合法 wave。
- 文件冲突任务不会被放入同一 wave。
- wave 大小不会超过并发限制。
- 系统能解释为什么某些任务没有进入当前 wave。

---

## 7.4 Worker 分配

系统需要将 wave 中的任务分配给 Worker Session。

### 分配策略

优先级：

1. 使用任务指定的 `preferred_agent`。
2. 根据任务类型选择 Agent。
3. 根据 Agent 当前负载选择空闲 Agent。
4. 如果没有合适 Agent，则等待或请求 Orchestrator 决策。

### Agent 类型示例

| Agent | 适合任务 |
|---|---|
| backend-agent | 服务端、协议、数据库、ET Handler |
| frontend-agent | UI、交互、客户端展示 |
| test-agent | 测试、验证、回归 |
| docs-agent | 文档、PRD、README |
| review-agent | 代码审查、规格审查 |
| ops-agent | 部署、脚本、环境 |

### 验收标准

- 每个任务可以被分配给一个 worker。
- 分配结果会写入 workflow state。
- 如果 worker 启动失败，任务回到 `ready` 或进入 `failed`。
- 同一个 worker 不应同时执行超过配置限制的任务。

---

## 7.5 任务状态管理

每个任务必须有明确状态。

### 状态枚举

| 状态 | 含义 |
|---|---|
| pending | 等待依赖完成 |
| ready | 依赖满足，等待调度 |
| running | 正在执行 |
| reviewing | 执行完成，等待审查 |
| done | 已完成 |
| failed | 执行失败 |
| blocked | 被依赖失败或外部条件阻塞 |
| cancelled | 已取消 |

### 状态流转

```txt
pending → ready → running → reviewing → done
                     ↓
                   failed
                     ↓
                  blocked downstream
```

### 验收标准

- 任意任务状态变化都必须记录到 audit log。
- 不允许从 `pending` 直接跳到 `running`。
- 不允许从 `failed` 直接跳到 `done`，除非有明确 retry 或 manual override 记录。
- 下游任务状态必须根据上游变化自动更新。

---

## 7.6 结果收集

每个 worker 完成任务后，必须返回结构化结果。

### 结果格式

```json
{
  "task_id": "T2",
  "status": "completed",
  "summary": "已实现服务端创建队伍 Handler。",
  "changed_files": [
    "Server/Hotfix/Team/CreateTeamHandler.cs"
  ],
  "tests_run": [
    "dotnet test"
  ],
  "risks": [],
  "next_recommendation": "进入联调测试。"
}
```

### 验收标准

- worker 必须返回任务结果。
- 结果必须包含 `task_id`、`status`、`summary`。
- 如果有文件变更，必须返回 `changed_files`。
- 如果任务失败，必须返回失败原因和建议处理方式。

---

## 7.7 Review Gate

每个 wave 完成后，系统必须进入 Review Gate。

Review Gate 负责：

1. 汇总本 wave 所有任务结果。
2. 检查是否有失败任务。
3. 检查是否有文件冲突。
4. 检查是否需要运行测试。
5. 判断是否允许进入下一 wave。

### Review Gate 输出示例

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

### 验收标准

- 每个 wave 结束后必须经过 Review Gate。
- 如果存在 critical failure，不能进入下一 wave。
- 如果 review 失败，必须生成阻塞原因。
- Review Gate 通过后，才允许调度下一 wave。

---

## 7.8 失败处理

任务失败时，系统应根据策略处理。

### 失败类型

| 类型 | 说明 | 默认处理 |
|---|---|---|
| transient | 临时错误，例如命令超时 | 可重试 |
| implementation | 实现错误 | 进入 review 或请求修复 |
| dependency | 上游缺失或错误 | 阻塞下游 |
| conflict | 文件冲突 | 序列化执行或人工处理 |
| permission | 权限不足 | 请求用户介入 |
| unknown | 未知错误 | 停止当前 wave |

### 重试策略

Phase 1 默认：

```json
{
  "max_retries": 1,
  "retry_on": ["transient"],
  "manual_review_on_second_failure": true
}
```

### 验收标准

- 临时失败最多重试一次。
- 非临时失败不会自动无限重试。
- 上游失败会阻塞依赖它的下游任务。
- 系统能输出失败报告。

---

## 7.9 状态持久化与恢复

系统必须持久化执行状态。

### 状态文件示例

```json
{
  "workflow_id": "wf_2026_04_26_001",
  "plan_id": "plan_2026_04_26_001",
  "current_wave": "wave_002",
  "status": "running",
  "tasks": {
    "T1": {
      "status": "done",
      "assigned_to": "backend-agent",
      "completed_at": "2026-04-26T10:20:00Z"
    },
    "T2": {
      "status": "running",
      "assigned_to": "backend-agent"
    }
  },
  "waves": [
    {
      "id": "wave_001",
      "tasks": ["T1"],
      "status": "done"
    },
    {
      "id": "wave_002",
      "tasks": ["T2", "T3", "T5"],
      "status": "running"
    }
  ]
}
```

### 恢复规则

系统重启后：

1. 读取 workflow state。
2. 检查 running 任务是否仍有 worker session。
3. 如果 session 存在，继续等待。
4. 如果 session 丢失，将任务标记为 `failed` 或 `ready`，根据策略决定。
5. 重新计算 ready tasks。

### 验收标准

- 系统中断后可以恢复状态。
- 已完成任务不会重复执行。
- 运行中但 session 丢失的任务会被明确处理。
- 恢复过程会写入 audit log。

---

## 8. 数据模型

## 8.1 Task

```json
{
  "id": "T1",
  "title": "定义消息协议",
  "description": "",
  "depends_on": [],
  "status": "pending",
  "can_parallel": true,
  "risk": "low",
  "expected_files": [],
  "changed_files": [],
  "preferred_agent": null,
  "assigned_to": null,
  "retry_count": 0,
  "created_at": "",
  "started_at": null,
  "completed_at": null
}
```

## 8.2 Wave

```json
{
  "id": "wave_001",
  "tasks": ["T1", "T2"],
  "status": "pending",
  "started_at": null,
  "completed_at": null,
  "review": null
}
```

## 8.3 Execution Policy

```json
{
  "max_parallel_tasks": 3,
  "max_agents": 3,
  "same_file_conflict_policy": "serialize",
  "review_after_each_wave": true,
  "stop_on_critical_failure": true,
  "max_retries": 1
}
```

## 8.4 Audit Event

```json
{
  "event_id": "evt_001",
  "workflow_id": "wf_2026_04_26_001",
  "type": "TASK_STATUS_CHANGED",
  "payload": {
    "task_id": "T1",
    "from": "ready",
    "to": "running"
  },
  "created_at": "2026-04-26T10:00:00Z"
}
```

---

## 9. 系统模块设计

```txt
ExecutionWorkflow
│
├── PlanLoader
│   └── 读取 WritingPlansWorkflow 输出的 Task DAG
│
├── DagValidator
│   └── 校验 DAG 格式、循环依赖、缺失任务引用
│
├── DependencyResolver
│   └── 计算 pending / ready / blocked 状态
│
├── Scheduler
│   └── 根据依赖、并发限制、风险、文件冲突生成 wave
│
├── WorkerPool
│   └── 分配任务给不同 Agent / session
│
├── ResultCollector
│   └── 收集 worker 执行结果
│
├── ConflictDetector
│   └── 检查文件冲突、结果冲突
│
├── ReviewGate
│   └── 审查 wave 结果，决定是否进入下一 wave
│
├── StateStore
│   └── 持久化任务状态、wave 状态、审计日志
│
└── RecoveryManager
    └── 中断恢复、丢失 session 处理
```

---

## 10. OpenClaw 集成方式

OpenClaw 负责提供执行底座：

```txt
多 Agent
多 Session
sessions_spawn
sessions_send
session history
workspace isolation
```

Annie 负责提供上层调度：

```txt
任务图
依赖解析
并发波次
任务分配
状态持久化
Review Gate
失败处理
Agent 通讯协议
```

### 映射关系

| Annie 概念 | OpenClaw 能力 |
|---|---|
| Worker Session | sessions_spawn |
| Task Dispatch | sessions_send |
| Agent Role | agent config / subagent |
| Result Collection | session reply / structured output |
| Execution Isolation | workspace / agentDir / session history |

### 10.1 集成边界

OpenClaw 的通讯机制可以作为底层传输层，但不应直接作为 Annie 的协作协议。

原因是：

1. OpenClaw session 通信更像“消息发送工具”，不是完整的任务协作协议。
2. 它不天然表达任务依赖、消息优先级、确认回执、重试、状态同步和审计。
3. 多 Agent 如果直接互相发消息，容易出现上下文污染、重复执行、责任不清和流程失控。
4. Annie 需要长期运行、可恢复、可审计，因此通讯必须落到状态存储和事件日志中。
5. Annie 的任务状态必须由 Orchestrator / StateStore 统一确认，不能由 Agent 之间的聊天直接决定。

因此，Annie 应采用：

```txt
Annie Communication Protocol
  ↓
OpenClaw sessions_send / sessions_spawn
```

而不是让所有 Agent 直接依赖 OpenClaw 原始通信方式协作。

### 10.2 通讯分层原则

Annie 的通讯系统分为三层：

```txt
业务协作层：Task / Review / Help / Approval 等协议语义
  ↓
消息治理层：MessageBus / Mailbox / ACK / Retry / Audit
  ↓
传输适配层：OpenClaw sessions_send / sessions_spawn
```

OpenClaw 只负责最后一层：把消息送到对应 session。

Annie 自己负责前两层：消息代表什么、谁有权限处理、是否需要 ACK、是否影响任务状态、是否需要写入审计日志。

---

## 11. Agent 通讯设计

### 11.1 设计目标

Agent 通讯系统需要解决：

1. Agent 之间如何交换任务结果。
2. Agent 如何向 Orchestrator 汇报进度。
3. Agent 如何请求其他 Agent 协助。
4. Agent 如何避免私下乱改状态。
5. 消息如何持久化、追踪、恢复和审计。
6. 通讯失败后如何重试或降级。
7. Agent 之间如何在不污染全局状态的前提下共享有限上下文。

### 11.2 核心原则

Annie 内部通讯遵循以下原则：

```txt
默认集中路由
有限点对点
状态优先于聊天
事件优先于自然语言
所有关键消息必须可审计
```

解释：

1. **默认集中路由**：Agent 默认不直接互相指挥，先通过 Orchestrator 或 MessageBus。
2. **有限点对点**：允许 Agent 之间发协作消息，但必须经过协议层记录。
3. **状态优先于聊天**：任务状态以 StateStore 为准，不以聊天记录为准。
4. **事件优先于自然语言**：关键通讯必须结构化，例如 `TASK_COMPLETED`、`HELP_REQUESTED`。
5. **所有关键消息必须可审计**：任务相关消息必须写入 audit log。

### 11.3 推荐架构

```txt
Agent Communication Layer
│
├── MessageBus
│   └── 负责消息投递、路由、持久化
│
├── MailboxStore
│   └── 每个 Agent 的收件箱 / 发件箱
│
├── EventLog
│   └── 记录所有关键通讯事件
│
├── MessageRouter
│   └── 根据任务、角色、权限选择接收方
│
├── ProtocolValidator
│   └── 校验消息格式、权限和状态合法性
│
├── ContextChannel
│   └── 管理 Agent 之间可共享的有限上下文
│
└── OpenClawAdapter
    └── 将 Annie 消息转换为 OpenClaw session 消息
```

OpenClaw 只放在最底层，作为实际发送消息的 adapter。

### 11.4 通讯模式

Annie 支持三种通讯模式。

#### 模式 1：Agent → Orchestrator

用于任务进度、任务完成、失败上报、请求决策。

```txt
Worker Agent
  ↓
MessageBus
  ↓
Orchestrator
  ↓
StateStore / Scheduler
```

适用消息：

```txt
TASK_STARTED
TASK_PROGRESS
TASK_COMPLETED
TASK_FAILED
BLOCKER_REPORTED
USER_APPROVAL_REQUIRED
```

这是默认模式。

#### 模式 2：Orchestrator → Agent

用于任务分发、重试、取消、补充上下文。

```txt
Orchestrator
  ↓
MessageBus
  ↓
Worker Agent
```

适用消息：

```txt
TASK_ASSIGNED
TASK_CANCELLED
TASK_RETRY_REQUESTED
CONTEXT_UPDATED
REVIEW_REQUESTED
```

#### 模式 3：Agent → Agent，受控点对点

用于跨 Agent 协作，但必须经过 MessageBus。

```txt
Backend Agent
  ↓
MessageBus / MailboxStore
  ↓
Frontend Agent
```

适用消息：

```txt
HELP_REQUESTED
INTERFACE_READY
QUESTION_ASKED
ANSWER_PROVIDED
REVIEW_COMMENT
```

限制：

1. Agent 不能通过点对点消息修改全局任务状态。
2. Agent 不能直接要求另一个 Agent 开始新任务。
3. Agent 不能绕过 Orchestrator 创建任务。
4. 点对点消息必须关联 `workflow_id` 和 `task_id`。

### 11.5 消息类型

Phase 1 支持以下消息类型：

| 类型 | 方向 | 说明 |
|---|---|---|
| TASK_ASSIGNED | Orchestrator → Agent | 分配任务 |
| TASK_STARTED | Agent → Orchestrator | 任务开始 |
| TASK_PROGRESS | Agent → Orchestrator | 进度更新 |
| TASK_COMPLETED | Agent → Orchestrator | 任务完成 |
| TASK_FAILED | Agent → Orchestrator | 任务失败 |
| HELP_REQUESTED | Agent → Agent / Orchestrator | 请求协助 |
| QUESTION_ASKED | Agent → Agent | 提问 |
| ANSWER_PROVIDED | Agent → Agent | 回答 |
| REVIEW_REQUESTED | Orchestrator → Reviewer | 请求审查 |
| REVIEW_COMMENT | Reviewer → Agent / Orchestrator | 审查意见 |
| BLOCKER_REPORTED | Agent → Orchestrator | 阻塞上报 |
| APPROVAL_REQUIRED | Orchestrator → User | 需要用户确认 |

### 11.6 消息结构

所有关键消息使用统一结构。

```json
{
  "message_id": "msg_001",
  "workflow_id": "wf_2026_04_26_001",
  "task_id": "T2",
  "wave_id": "wave_002",
  "from": "backend-agent",
  "to": "orchestrator",
  "type": "TASK_COMPLETED",
  "priority": "normal",
  "requires_ack": true,
  "created_at": "2026-04-26T10:30:00Z",
  "payload": {
    "summary": "已完成服务端 Handler 实现。",
    "changed_files": [
      "Server/Hotfix/Team/CreateTeamHandler.cs"
    ],
    "tests_run": [
      "dotnet test"
    ],
    "risks": []
  }
}
```

### 11.7 ACK 与重试

关键消息必须支持 ACK。

```txt
Message Sent
  ↓
Delivered
  ↓
Acknowledged
  ↓
Processed
```

如果消息没有被确认：

1. 先重试投递。
2. 重试失败后标记为 `delivery_failed`。
3. 如果是关键任务消息，通知 Orchestrator。
4. Orchestrator 决定是否重新派发任务或人工介入。

Phase 1 默认策略：

```json
{
  "requires_ack_default": true,
  "max_delivery_retries": 2,
  "ack_timeout_seconds": 60
}
```

### 11.8 MailboxStore

每个 Agent 都有自己的 mailbox。

```txt
mailboxes/
├── orchestrator/
│   ├── inbox.jsonl
│   └── outbox.jsonl
├── backend-agent/
│   ├── inbox.jsonl
│   └── outbox.jsonl
└── frontend-agent/
    ├── inbox.jsonl
    └── outbox.jsonl
```

Phase 1 可以使用本地 JSONL 文件实现。

每条消息一行，方便追加、恢复和审计。

### 11.9 MessageBus 与 StateStore 的关系

MessageBus 负责消息流转。

StateStore 负责真实状态。

二者关系：

```txt
Agent 发送 TASK_COMPLETED
  ↓
MessageBus 记录消息
  ↓
ProtocolValidator 校验
  ↓
Orchestrator 处理消息
  ↓
StateStore 更新任务状态
  ↓
AuditLog 记录状态变化
```

关键原则：

> Agent 发消息不等于状态已改变。只有 Orchestrator 处理并写入 StateStore 后，状态才算改变。

### 11.10 为什么不直接沿用 OpenClaw 通讯

OpenClaw 的通信能力可以发送消息，但 Annie 需要的是协作协议。

| 需求 | 直接用 OpenClaw 通信 | Annie Communication Layer |
|---|---|---|
| 消息发送 | 支持 | 支持 |
| 任务关联 | 需要自行约定 | 内建 workflow_id / task_id |
| 状态更新 | 不负责 | 由 Orchestrator 写入 StateStore |
| ACK | 不一定完整表达 | 协议内建 |
| 重试 | 依赖底层能力 | 协议内建 |
| 审计 | 不完整 | EventLog / MailboxStore |
| 权限控制 | 弱 | ProtocolValidator |
| 恢复 | 弱 | 可从 StateStore + Mailbox 恢复 |
| 点对点约束 | 弱 | 受控点对点 |
| 上下文隔离 | 依赖 session 约束 | ContextChannel 明确控制共享范围 |

因此 OpenClaw 应作为底层 adapter，而不是 Annie 的最终通讯模型。

### 11.11 推荐通讯策略

Phase 1 推荐采用“中心化消息总线 + 受控点对点”的混合模式。

```txt
默认路径：Agent → MessageBus → Orchestrator → StateStore
协作路径：Agent → MessageBus → Target Agent Mailbox
传输路径：MessageBus → OpenClawAdapter → sessions_send
```

关键规则：

1. 任务状态只能由 Orchestrator 更新。
2. Agent 可以互相提问，但不能互相分配新任务。
3. 点对点消息必须绑定 `workflow_id`、`task_id`、`wave_id`。
4. 所有影响任务执行的消息都必须 requires_ack。
5. OpenClaw 消息发送失败不等于任务失败，需要由 MessageBus 判断是否重试或上报。

Phase 1 不需要实现复杂实时聊天，只需要实现：

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
```

这些消息已经足够支撑 DAG 并发执行、结果收集和 Review Gate。

### 11.12 通讯状态

每条消息也需要状态，避免“发出去了但没人处理”的问题。

| 状态 | 含义 |
|---|---|
| created | 消息已创建 |
| queued | 已进入发送队列 |
| delivered | 已投递到目标 mailbox 或 session |
| acknowledged | 目标已确认收到 |
| processed | 消息已被处理 |
| failed | 投递或处理失败 |
| expired | 超时未处理 |

消息状态不等于任务状态。

例如：

```txt
TASK_COMPLETED 消息 processed
  ↓
Orchestrator 校验结果
  ↓
StateStore 将任务从 running 更新为 reviewing 或 done
```

只有 StateStore 更新后，任务状态才真正改变。

---

## 12. 权限与门禁

### 12.1 执行门禁

不允许跳过：

```txt
Design Spec → Writing Plan → Task DAG → Execution
```

如果没有 Task DAG，ExecutionWorkflow 不能启动。

### 12.2 并发门禁

任务不能并发执行，如果：

1. 存在依赖关系。
2. 会修改相同文件。
3. 都是高风险任务。
4. 用户明确要求串行。
5. 需要人工确认。

### 12.3 Review 门禁

每个 wave 完成后必须经过 Review Gate。

如果 Review Gate 失败，不能进入下一 wave。

---

## 12. MVP 范围

Phase 1 MVP 需要实现：

1. DAG 格式任务计划。
2. DAG 校验。
3. ready task 计算。
4. wave 生成。
5. 基于文件冲突的简单串行化。
6. max_parallel_tasks 限制。
7. worker 分配记录。
8. 任务状态流转。
9. wave 级 Review Gate。
10. 状态文件持久化。
11. 基础失败处理。
12. 基础 MessageBus。
13. Agent MailboxStore。
14. 核心消息类型 schema。
15. ACK 与投递重试。

Phase 1 不要求：

1. 自动修改代码。
2. 复杂 Agent 间通信。
3. 分布式执行。
4. 高级资源调度。
5. UI 看板。

---

## 13. 验收标准

### 13.1 基础验收

- 给定一个合法 DAG，系统能生成正确执行 wave。
- 给定一个循环依赖 DAG，系统拒绝执行。
- 给定多个独立任务，系统能并发调度。
- 给定文件冲突任务，系统能自动拆分 wave。
- 给定任务失败，系统能阻塞依赖它的下游任务。

### 13.2 状态验收

- 每个任务状态变化都有记录。
- 每个 wave 状态都有记录。
- 系统中断后可以读取 state 并恢复。
- 已完成任务不会重复执行。

### 13.3 Review 验收

- 每个 wave 结束后进入 Review Gate。
- Review Gate 失败时不会进入下一 wave。
- Review Gate 通过后才调度下一 wave。

### 13.4 集成验收

- `WritingPlansWorkflow` 可以输出 Task DAG。
- `ExecutionWorkflow` 可以读取 Task DAG。
- Scheduler 可以将任务分配给对应 Worker Agent。
- Worker 执行结果可以被 ResultCollector 解析。

---

## 14. 示例：完整执行过程

### 输入任务图

```txt
T1 定义协议
T2 实现服务端，依赖 T1
T3 实现客户端，依赖 T1
T4 写测试，依赖 T2 + T3
T5 更新文档，依赖 T1
T6 最终 Review，依赖 T4 + T5
```

### 调度结果

```txt
Wave 1:
  T1

Wave 2:
  T2
  T3
  T5

Wave 3:
  T4

Wave 4:
  T6
```

### 状态变化

```txt
T1 pending → ready → running → reviewing → done
T2 pending → ready → running → reviewing → done
T3 pending → ready → running → reviewing → done
T5 pending → ready → running → reviewing → done
T4 pending → ready → running → reviewing → done
T6 pending → ready → running → reviewing → done
```

---

## 15. 风险与应对

| 风险 | 说明 | 应对 |
|---|---|---|
| 并发导致文件冲突 | 多 Agent 同时修改同一文件 | expected_files + changed_files 检查 |
| 计划依赖不准确 | WritingPlansWorkflow 输出错误 DAG | DagValidator + Review Gate |
| Agent 执行结果不结构化 | 无法收集结果 | 强制结果 schema |
| 任务失败影响下游 | 下游继续执行导致浪费 | blocked 状态传播 |
| 状态丢失 | 执行中断后无法恢复 | StateStore + AuditLog |
| 过度并发 | 协调成本超过收益 | max_parallel_tasks + wave-based execution |

---

## 16. 后续规划

### Phase 2：增强调度

- Agent 负载感知。
- 风险评分。
- 自动重试策略配置。
- 更智能的文件冲突预测。

### Phase 3：可视化

- Workflow 看板。
- DAG 图展示。
- Wave 执行进度。
- 失败任务追踪。

### Phase 4：长期记忆接入

- 将高质量执行结果写入 Annie Memory。
- 记录用户偏好的并发策略。
- 记录项目常见任务模板。

### Phase 5：跨项目调度

- 多项目任务队列。
- 全局 Agent 池。
- 用户级优先级调度。

---

## 17. 一句话总结

`TaskGraphScheduler` 是 Annie 从“线性流程助手”升级为“真正工作流系统”的关键模块。

它的核心价值是：

> Brainstorming 负责想清楚，Writing Plans 负责拆清楚，TaskGraphScheduler 负责判断哪些任务可以一起做，并把它们安全地并发执行。

