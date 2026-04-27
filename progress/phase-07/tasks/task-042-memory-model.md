# T042 Memory Model And Adapter Boundary

## 状态

`done`

## 目标

定义长期记忆接入所需的稳定模型和 adapter 边界。

## 范围

- 新增 `src/memory/model.ts`。
- 定义 `MemoryRecord`。
- 定义 `MemoryCandidate`。
- 定义 `MemoryAdapter`。
- 定义 category / confidence / provenance。
- 从 `src/index.ts` 导出。

## 验收标准

- 模型能表达 execution result、preference、template pattern 三类 memory。
- 每条 memory 具备 provenance，可追溯 workflow / wave / task。
- Adapter 边界不依赖真实 Annie Memory 服务。
- 类型测试可构造合法 memory candidate / record。

## 关联代码

- `src/memory/model.ts`
- `src/index.ts`
- `tests/memory.test.ts`

## 完成记录

- 新增 `src/memory/model.ts`。
- 定义 MemoryRecord、MemoryCandidate、MemoryAdapter。
- 定义 memoryCategories、MemoryCategory、memoryConfidenceLevels、MemoryConfidence。
- 定义 MemoryProvenance、MemoryWriteOptions、MemoryListFilter。
- 新增 `src/memory/index.ts` 并从根入口导出。
- 新增 `tests/memory.test.ts` 覆盖模型构造、adapter 边界和 enum 导出。

## 验证结果

```txt
npm run typecheck
npm run build
npm test
101 passed
```
