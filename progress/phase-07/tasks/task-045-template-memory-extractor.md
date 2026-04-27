# T045 Template Memory Candidate Extractor

## 状态

`done`

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

## 完成记录

- 在 `src/memory/extractors.ts` 增加 `extractTemplateMemoryCandidates`。
- 仅从全量完成且 ReviewGate 通过、无失败 review wave 的 workflow 中生成 `template_pattern` candidate。
- candidate 记录 task count、wave count、dependency edge count、capabilities、preferred agents、risks 和结构化 task pattern。
- 不记录文件正文，也不直接写入 TemplateRegistry。

## 验证结果

```txt
npm run typecheck: pass
npm run build: pass
npm test: 107 passed
```
