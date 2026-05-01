# T125 Result Intake Endpoint

## 状态

`done`

## 目标

提供 runtime-neutral result intake endpoint。

## 范围

- 新增 endpoint request parsing。
- 调用 result intake service。
- 返回结构化 result intake response。
- `serve` 输出 endpoint URL。

## 验收标准

- Endpoint 可接收 task result。
- Endpoint 不自动 review。
- 错误返回结构化 code/message。

## 关联代码

- `src/server/inbound_server.ts`
- `src/cli.ts`

## 完成记录

- 新增 `POST /agent-results`。
- 新增 `receiveAgentResult` helper。
- 新增 agent result payload parser。
- `serve` endpoint 列表输出 `agent_results`。
- Endpoint 复用 `intakeAgentResult`，不自动 review。

## 验证结果

```txt
npm run typecheck: pass
npm run build: pass
```
