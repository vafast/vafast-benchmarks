# 🚀 批量框架测试功能总结

现在你可以同时运行所有框架的性能测试，并将结果保存到特定的文件夹中！

## ✨ 新增功能概览

### 1. **批量框架测试器** (`batch-framework-tester.ts`)
- 同时测试所有可用框架
- 自动保存结果到指定文件夹
- 支持K6测试集成
- 生成多种格式的报告

### 2. **演示批量测试器** (`demo-batch-test.ts`)
- 使用模拟数据演示功能
- 快速验证批量测试器工作
- 无需真实框架环境

## 🎯 支持的框架

- **Elysia** (端口: 3000)
- **Hono** (端口: 3001) 
- **Express** (端口: 3002)
- **Koa** (端口: 3003)
- **Vafast-Mini** (端口: 3004)
- **Vafast** (端口: 3005)

## 🚀 使用方法

### 快速开始（演示版）

```bash
# 运行演示测试（10秒，默认输出目录）
npm run demo:batch

# 快速演示测试（5秒）
npm run demo:batch:quick

# 自定义演示测试
npm run demo:batch:custom
```

### 真实框架测试

```bash
# 运行默认测试（10秒）
npm run batch:test

# 快速测试（5秒）
npm run batch:test:quick

# 完整测试（30秒，包含K6）
npm run batch:test:full

# 包含K6测试
npm run batch:test:k6
```

### 高级用法

```bash
# 自定义测试时长和输出目录
bun run batch-framework-tester.ts 15 test-results/my-test

# 包含K6测试
bun run batch-framework-tester.ts 20 test-results/k6-test --k6

# 不保存详细结果
bun run batch-framework-tester.ts 10 test-results/simple --no-details

# 不生成对比报告
bun run batch-framework-tester.ts 10 test-results/no-report --no-report
```

## 📁 输出文件结构

测试完成后，会在指定的输出目录中生成：

```
test-results/batch-test/
├── elysia-detailed-results.json          # 单个框架详细结果
├── hono-detailed-results.json
├── express-detailed-results.json
├── koa-detailed-results.json
├── vafast-mini-detailed-results.json
├── vafast-detailed-results.json
├── batch-test-summary-[timestamp].json   # 汇总结果
└── comparison-report-[timestamp].md      # Markdown对比报告
```

## 📊 结果格式

### 详细结果文件
每个框架的详细结果包含：
- 👑 冷启动指标
- ⚡️ 每秒请求数
- 📉 平均延迟
- 🎯 总请求数
- 📊 性能详情（延迟范围、错误率、内存使用）

### 汇总结果文件
包含所有框架的测试结果和排名：
- 按RPS排名
- 按延迟排名
- 按冷启动时间排名

### Markdown对比报告
生成漂亮的对比报告，包含：
- 🚀 RPS排名表格
- ⏱️ 延迟排名表格
- ❄️ 冷启动排名表格
- 📊 详细性能数据表格
- 📝 测试总结

## ⚙️ 配置选项

### 命令行参数
- **第1个参数**: 测试时长（秒），默认10秒
- **第2个参数**: 输出目录，默认 `test-results/batch-test`
- **--k6**: 包含K6测试
- **--no-details**: 不保存详细结果
- **--no-report**: 不生成对比报告

## 🔧 环境要求

- **Node.js**: >= 18.0.0
- **Bun**: >= 1.0.0
- **K6**: 已安装（如果使用--k6选项）

## 📝 注意事项

1. **演示版本**: `demo-batch-test.ts` 使用模拟数据，无需真实框架
2. **真实测试**: `batch-framework-tester.ts` 需要真实的框架环境
3. **端口占用**: 确保3000-3005端口未被占用
4. **结果清理**: 测试完成后会自动清理服务器资源

## 🎉 开始使用

### 1. 先试试演示版本
```bash
npm run demo:batch:quick
```

### 2. 查看生成的结果
```bash
ls test-results/demo-batch-test/
```

### 3. 运行真实测试（如果有框架环境）
```bash
npm run batch:test
```

## 💡 使用建议

1. **开发阶段**: 使用演示版本快速验证功能
2. **测试阶段**: 使用真实批量测试器进行性能对比
3. **报告生成**: 利用生成的Markdown报告进行分享
4. **数据保存**: 所有结果都会保存，方便后续分析

现在你可以轻松地同时测试所有框架，并获得完整的性能对比报告！🚀

## 📚 相关文档

- [批量测试器详细指南](README-batch-tester.md)
- [K6测试配置说明](README-k6.md)
- [通用测试器说明](README-universal-tester.md)
