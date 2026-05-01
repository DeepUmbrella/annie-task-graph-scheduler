# T112 Next-Wave Endpoint

## 状态

`todo`

## 目标

提供 runtime-neutral next-wave scheduling endpoint。

## 范围

- 新增 next-wave request parsing。
- 调用 schedule next wave service。
- 返回结构化 scheduling result。
- `serve` 输出 endpoint URL。

## 验收标准

- endpoint 可 schedule workflow。
- endpoint 不 dispatch。
- 错误返回结构化 code/message。

## 关联代码

- `src/server/inbound_server.ts`
- `src/cli.ts`
