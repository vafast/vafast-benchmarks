# 基准测试工具函数

这个目录包含了用于基准测试的各种工具函数，主要模拟TechEmpower风格的测试场景。

## 文件结构

- `database-benchmark-utils.ts` - 数据库相关测试工具
- `complex-json-utils.ts` - 复杂对象序列化测试工具
- `batch-processing-utils.ts` - 批量数据处理测试工具
- `index.ts` - 统一导出文件

## 功能说明

### 1. 数据库基准测试工具 (`database-benchmark-utils.ts`)

#### `simulateDatabaseQuery(queries: string | undefined)`
- 模拟数据库查询测试
- 参数：查询数量（字符串，限制在1-500之间）
- 返回：查询结果数组或单个结果

#### `simulateDatabaseUpdate(queries: string | undefined)`
- 模拟数据库更新测试
- 参数：更新数量（字符串，限制在1-500之间）
- 返回：更新结果数组或单个结果

### 2. 复杂对象序列化测试工具 (`complex-json-utils.ts`)

#### `simulateComplexJsonSerialization(depth: string | undefined)`
- 创建嵌套对象进行序列化性能测试
- 参数：嵌套深度（字符串，限制在1-10之间）
- 返回：嵌套对象

#### `createNestedObject(currentDepth: number)`
- 内部函数，用于创建指定深度的嵌套对象

### 3. 批量数据处理测试工具 (`batch-processing-utils.ts`)

#### `simulateBatchProcessing(body: BatchProcessRequest)`
- 模拟批量数据处理的性能测试
- 参数：包含items和operation的请求体
- 返回：处理结果，包含处理时间等性能指标

#### 类型定义
- `BatchItem`: 单个数据项
- `BatchProcessRequest`: 请求体结构
- `BatchProcessResult`: 处理结果结构

## 使用示例

```typescript
import { 
  simulateDatabaseQuery, 
  simulateDatabaseUpdate, 
  simulateComplexJsonSerialization, 
  simulateBatchProcessing 
} from '../utils';

// 数据库查询测试
const queryResult = simulateDatabaseQuery("10");

// 数据库更新测试
const updateResult = simulateDatabaseUpdate("5");

// 复杂对象序列化测试
const complexObject = simulateComplexJsonSerialization("5");

// 批量数据处理测试
const batchResult = simulateBatchProcessing({
  items: [
    { id: 1, value: 100, name: "item1" },
    { id: 2, value: 200, name: "item2" }
  ],
  operation: "sum"
});
```

## 注意事项

1. 所有函数都包含了适当的参数验证和边界检查
2. 数据库测试函数限制查询/更新数量在1-500之间
3. 复杂对象序列化测试限制嵌套深度在1-10之间
4. 批量数据处理测试包含错误处理机制
5. 所有函数都返回可序列化的数据，便于JSON传输
