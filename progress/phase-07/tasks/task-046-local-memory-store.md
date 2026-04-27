# T046 Local Memory Store

## 状态

`todo`

## 目标

实现本地 JSONL MemoryStore，作为真实 Annie Memory 接入前的 mock adapter。

## 范围

- 新增 `src/memory/local_store.ts`。
- 支持 append record。
- 支持 list records。
- 支持 findByCategory。
- 支持基于 source key 去重。
- 默认路径 `.annie/memory/records.jsonl`。

## 验收标准

- memory 文件不存在时返回空列表。
- append 后可读取。
- 同 source key 不重复写入。
- 错误返回 TaskGraphSchedulerError。

## 关联代码

- `src/memory/local_store.ts`
- `tests/memory.test.ts`
