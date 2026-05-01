# T125 Result Intake Endpoint

## 状态

`todo`

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
