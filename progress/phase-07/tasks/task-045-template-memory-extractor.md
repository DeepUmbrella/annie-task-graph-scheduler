# T045 Template Memory Candidate Extractor

## 状态

`todo`

## 目标

从成功 workflow 的 task graph shape 中提取项目常见任务模板候选。

## 范围

- 扩展 `src/memory/extractors.ts`。
- 基于 done workflow / passed waves 生成 template_pattern candidates。
- 提取 task count、dependency shape、capabilities、tags。
- 不直接写入 TemplateRegistry。

## 验收标准

- 成功 workflow 可生成 template pattern candidate。
- 未完成或失败 workflow 不生成 template pattern candidate。
- candidate 只记录结构化 task pattern，不包含敏感文件正文。
- 可被后续 TemplateRegistry 或 Annie Memory 使用。

## 关联代码

- `src/memory/extractors.ts`
- `src/models/template.ts`
- `tests/memory.test.ts`
