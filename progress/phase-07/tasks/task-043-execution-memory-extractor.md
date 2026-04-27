# T043 Execution Memory Candidate Extractor

## 状态

`done`

## 目标

从 workflow execution state 中提取高质量执行结果 memory candidates。

## 范围

- 新增 / 扩展 `src/memory/extractors.ts`。
- 从 done task 提取 execution_result candidates。
- 只提取已通过 review 的 wave 或已 done 的 task。
- 记录 summary、changed_files、tests_run、risks_found。
- 保留 workflow / wave / task provenance。

## 验收标准

- failed / blocked / running / pending task 不生成高质量 execution memory。
- done task 可以生成 candidate。
- candidate 不包含文件正文内容。
- candidate 可追溯到 source workflow 和 task。

## 关联代码

- `src/memory/extractors.ts`
- `tests/memory.test.ts`

## 完成记录

- 新增 `src/memory/extractors.ts`。
- 实现 `extractExecutionMemoryCandidates`。
- 仅从 passed ReviewGate 的 wave 中提取 done task。
- candidate content 只包含结构化摘要、文件路径、测试名、风险摘要等元数据，不读取文件正文。
- 保留 workflow / plan / wave / task provenance 和稳定 source_key。
- 扩展 `tests/memory.test.ts` 覆盖提取和跳过逻辑。

## 验证结果

```txt
npm run typecheck
npm run build
npm test
103 passed
```
