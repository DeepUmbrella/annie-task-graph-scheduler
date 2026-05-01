# T087 OpenClaw Discovery Adapter

## 状态

`done`

## 目标

实现 OpenClaw runtime discovery adapter。

## 范围

- 调用 `openclaw agents list --json`。
- 支持 injected runner 测试。
- 将 OpenClaw agents 转换为 candidate nodes。
- OpenClaw 不可用时记录 unavailable metadata。

## 验收标准

- adapter 不需要真实 OpenClaw 即可测试。
- agents list JSON 可转换为 candidate nodes。
- CLI 失败时返回 unavailable runtime candidate。
- adapter 不注册 node。

## 关联代码

- `src/runtime_discovery/openclaw_discovery.ts`
- `tests/runtime_discovery.test.ts`

## 实施记录

- 新增 `discoverOpenClawCandidates`。
- 使用可注入 `OpenClawCommandRunner`，测试不依赖真实 OpenClaw。
- 调用参数为 `openclaw agents list --json`。
- 支持直接数组和 `{ agents: [...] }` 两种 JSON 结构。
- 将 OpenClaw agent 转换为 `CandidateNode`。
- runner 失败时返回 `openclaw` unavailable runtime metadata。
- adapter 不注册 node，不写 Node Registry。

## 验证

- `npm run typecheck` passed.
- `npm run build` passed.
- `node --test dist/tests/runtime_discovery.test.js` passed.
