# T119 Dispatch Endpoint

## 状态

`done`

## 目标

提供 runtime-neutral wave dispatch endpoint。

## 范围

- 新增 dispatch request parsing。
- 调用 dispatch service。
- 返回结构化 dispatch result。
- `serve` 输出 endpoint URL。

## 验收标准

- Endpoint 可 dispatch scheduled wave。
- Endpoint 不调用 OpenClaw。
- 错误返回结构化 code/message。

## 关联代码

- `src/server/inbound_server.ts`
- `src/cli.ts`

## 完成记录

- 新增 `POST /workflow-dispatch`。
- 新增 `receiveWorkflowDispatch` helper。
- 新增 workflow dispatch payload parser。
- `serve` endpoint 列表输出 `workflow_dispatch`。
- Endpoint 复用 `dispatchWorkflowWave`，不调用 OpenClaw。

## 验证结果

```txt
npm run typecheck: pass
npm run build: pass
```
