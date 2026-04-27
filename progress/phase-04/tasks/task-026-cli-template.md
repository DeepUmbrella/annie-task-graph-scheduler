# T026 CLI Template Command

## 状态

`done`

## 目标

CLI 支持 template list/show/instantiate 命令。

## 范围

- `template list` — 列出所有可用模板
- `template show --template <id>` — 显示模板详情
- `template instantiate --template <id> --plan-id <plan_id>` — 输出 plan JSON

## 验收标准

- CLI template list 输出模板列表。
- CLI template show 输出模板详情。
- CLI template instantiate 输出合法 plan JSON。
