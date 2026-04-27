# T013 Conflict Prediction

## 状态

`todo`

## 目标

增强文件冲突预测能力，降低多 Agent 并发修改产生实际冲突的概率。

## 范围

- 保留 Phase 01 精确文件匹配。
- 增加目录级冲突判断。
- 增加 glob pattern 支持。
- 对缺少 `expected_files` 的任务按 policy 处理：
  - allow
  - serialize
  - require_review
- ReviewGate 继续检查实际 `changed_files` 冲突。
- skipped reason 输出冲突类型。

## 验收标准

- 相同文件仍然冲突。
- 同一目录可根据 policy 判定为冲突。
- glob 命中可判定为冲突。
- 未声明 expected files 的任务可被策略串行化。
- Phase 01 文件冲突测试继续通过。

## 关联代码

- `src/scheduler/conflict_detector.ts`
- `src/scheduler/scheduler.ts`
- `src/execution/review_gate.ts`
- `tests/scheduler.test.ts`

