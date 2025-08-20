# 🚀 重新整理的脚本命名说明

经过重新整理，现在的脚本命名更加科学和直观！

## 📋 脚本分类

### 1. **单个服务器测试** (`benchmark:single`)
```bash
# 测试单个服务器性能（默认10秒）
npm run benchmark:single

# 自定义时长测试
npm run benchmark:single:custom
```

**用途**: 测试当前服务器的性能，测量具体的性能指标

### 2. **批量框架测试** (`benchmark:batch`)
```bash
# 测试所有框架（默认10秒）
npm run benchmark:batch

# 快速测试（5秒）
npm run benchmark:batch:quick

# 完整测试（30秒，包含K6）
npm run benchmark:batch:full

# 包含K6测试
npm run benchmark:batch:k6
```

**用途**: 对比多个框架的性能，生成排名报告

### 3. **功能演示** (`demo`)
```bash
# 演示功能（默认10秒）
npm run demo:showcase

# 快速演示（5秒）
npm run demo:quick

# 自定义演示
npm run demo:custom
```

**用途**: 展示批量测试器功能，使用模拟数据

### 4. **服务器管理**
```bash
# 启动所有框架服务器
npm run start:servers
```

## 🎯 命名原则

### 1. **功能导向**
- `benchmark:single` - 单个服务器测试
- `benchmark:batch` - 批量框架测试
- `demo:showcase` - 功能演示

### 2. **层次清晰**
- 主分类用冒号分隔
- 子分类用冒号分隔
- 参数用描述性名称

### 3. **易于理解**
- 一看就知道做什么
- 符合直觉
- 避免缩写

## 🔄 新旧命名对比

| 新命名 | 旧命名 | 功能说明 |
|--------|--------|----------|
| `benchmark:single` | `k6:full` | 测试单个服务器 |
| `benchmark:single:custom` | - | 自定义时长测试 |
| `benchmark:batch` | `batch:test` | 测试多个框架 |
| `benchmark:batch:quick` | `batch:test:quick` | 快速框架测试 |
| `benchmark:batch:full` | `batch:test:full` | 完整框架测试 |
| `demo:showcase` | `demo:batch` | 功能演示 |
| `demo:quick` | `demo:batch:quick` | 快速演示 |

## 🚀 推荐使用顺序

### 1. **新手入门**
```bash
# 先看演示功能
npm run demo:quick
```

### 2. **了解性能**
```bash
# 测试当前服务器负载能力
npm run benchmark:single
```

### 3. **框架对比**
```bash
# 对比不同框架性能
npm run benchmark:batch:quick
```

## 💡 命名优势

1. **功能明确**: 一看就知道测试什么
2. **层次清晰**: 主分类、子分类一目了然
3. **易于记忆**: 符合直觉的命名
4. **扩展性好**: 容易添加新的测试类型

## 🎉 现在更清晰了！

- **`benchmark:single`** = "测试单个服务器"
- **`benchmark:batch`** = "测试多个框架"  
- **`demo:showcase`** = "演示功能"

命名更科学，单个/批量更清楚！🚀
