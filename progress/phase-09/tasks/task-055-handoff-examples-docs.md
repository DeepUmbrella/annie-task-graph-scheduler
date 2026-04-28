# T055 Handoff Examples And Docs

## 状态

`todo`

## 目标

补充本地 handoff 示例和文档，让不同编辑器客户端可以快速理解 plan 输入与 report 输出。

## 范围

- 新增 example handoff plan。
- 新增 docs handoff contract 文档。
- 说明 `plan validate` 与 `report` CLI 用法。
- 说明真实 Annie Workflow API 未接入。

## 验收标准

- 示例 plan 可被 `plan validate` 通过。
- 文档包含上游输入、调度入口、下游 report 输出。
- 不宣称已经接入真实远端 Annie Workflow API。

## 关联代码

- `docs/*`
- `examples/*`
- `tests/e2e_handoff_cli.test.ts`
