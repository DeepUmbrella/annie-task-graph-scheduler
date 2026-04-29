# T064 Real OpenClaw CLI Client

## 状态

`done`

## 目标

新增真实 OpenClaw CLI client，用于通过 `openclaw agent` 投递 Annie message。

## 范围

- 扩展 `src/communication/openclaw_adapter.ts`。
- 使用 Node 内置 `child_process.execFile`。
- 支持 runner 注入，单测不调用真实 OpenClaw。
- 保持 `MockAdapter` 和现有 envelope 转换兼容。

## 验收标准

- OpenClaw CLI client 生成正确命令参数。
- `OpenClawAdapter` 可委托真实 client。
- 现有 adapter 测试继续通过。

## 关联代码

- `src/communication/openclaw_adapter.ts`
- `tests/openclaw_adapter.test.ts`

## 完成记录

- 新增 `OpenClawCliClient`，通过 `openclaw agent` 投递 envelope。
- 新增 `toOpenClawAgentArgs`，支持 `--agent`、`--message`、`--json`、`--session-id`、`--local`、`--thinking`、`--timeout`。
- 保留 `OpenClawAdapter` 和 `MockAdapter` 现有边界。
- 单测通过注入 runner 验证命令，不调用真实 OpenClaw。

## 验证结果

```txt
npm run typecheck: pass
npm run build: pass
node --test dist/tests/openclaw_adapter.test.js: 4 passed
```
