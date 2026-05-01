# T119 Dispatch Endpoint

## 状态

`todo`

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
