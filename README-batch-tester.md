# 🚀 批量框架测试器使用指南

这个批量测试器可以同时运行所有框架的性能测试，并将结果保存到指定的文件夹中。

## ✨ 主要功能

- **同时测试多个框架**: 自动测试所有可用的框架
- **结果保存**: 将测试结果保存到指定文件夹
- **多种输出格式**: JSON、Markdown报告
- **K6集成**: 可选择是否运行K6测试
- **中文报告**: 生成中文格式的性能报告

## 🎯 支持的框架

- **Elysia** (端口: 3000)
- **Hono** (端口: 3001) 
- **Express** (端口: 3002)
- **Koa** (端口: 3003)
- **Vafast-Mini** (端口: 3004)
- **Vafast** (端口: 3005)

## 🚀 使用方法

### 基本用法

```bash
# 运行默认测试（10秒）
npm run batch:test

# 运行快速测试（5秒）
npm run batch:test:quick

# 运行完整测试（30秒）
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

测试完成后，会在指定的输出目录中生成以下文件：

```
test-results/batch-test/
├── elysia-detailed-results.json          # Elysia详细结果
├── hono-detailed-results.json            # Hono详细结果
├── express-detailed-results.json         # Express详细结果
├── koa-detailed-results.json             # Koa详细结果
├── vafast-mini-detailed-results.json    # Vafast-Mini详细结果
├── vafast-detailed-results.json          # Vafast详细结果
├── batch-test-summary-2024-01-01T10-00-00-000Z.json  # 汇总结果
└── comparison-report-2024-01-01T10-00-00-000Z.md     # Markdown对比报告
```

## 📊 结果格式

### 详细结果文件 (JSON)

每个框架的详细结果包含：

```json
{
  "framework": "vafast",
  "timestamp": "2024-01-01T10:00:00.000Z",
  "testDuration": 10,
  "metrics": {
    "coldStart": {
      "emoji": "👑",
      "name": "冷启动",
      "value": "0.00 ms",
      "description": "0.00 ms. 无延迟，无妥协。冷启动王者之冠属于我们。"
    },
    "requestsPerSecond": {
      "emoji": "⚡️",
      "name": "每秒请求数",
      "value": "20359.76 rps",
      "description": "为瞬时流量而生 — 无需预热。"
    },
    "avgLatency": {
      "emoji": "📉",
      "name": "平均延迟",
      "value": "0.11 ms",
      "description": "压力之下依然迅捷。始终如一。"
    },
    "totalRequests": {
      "emoji": "🎯",
      "name": "总请求数",
      "value": "203604 req / 10s",
      "description": "在10秒内完成的总请求数"
    },
    "performance": {
      "minLatency": 0.05,
      "maxLatency": 2.1,
      "p95Latency": 0.8,
      "errorRate": 0.0,
      "memoryUsage": {
        "heapUsed": 45.2,
        "heapTotal": 67.8,
        "external": 12.3,
        "rss": 89.1
      }
    }
  }
}
```

### 汇总结果文件 (JSON)

包含所有框架的测试结果和排名：

```json
{
  "testInfo": {
    "timestamp": "2024-01-01T10:00:00.000Z",
    "testDuration": 10,
    "totalFrameworks": 6,
    "outputDirectory": "test-results/batch-test"
  },
  "results": [...],
  "rankings": {
    "byRPS": [
      {"rank": 1, "framework": "vafast", "rps": 20359.76},
      {"rank": 2, "framework": "elysia", "rps": 18923.45}
    ],
    "byLatency": [...],
    "byColdStart": [...]
  }
}
```

### Markdown对比报告

生成漂亮的Markdown格式对比报告，包含：

- 🚀 RPS排名
- ⏱️ 延迟排名  
- ❄️ 冷启动排名
- 📊 详细性能数据表格
- 📝 测试总结

## ⚙️ 配置选项

### 命令行参数

- **第1个参数**: 测试时长（秒），默认10秒
- **第2个参数**: 输出目录，默认 `test-results/batch-test`
- **--k6**: 包含K6测试
- **--no-details**: 不保存详细结果
- **--no-report**: 不生成对比报告

### 示例配置

```bash
# 测试15秒，保存到 custom-results 目录，包含K6测试
bun run batch-framework-tester.ts 15 custom-results --k6

# 快速测试5秒，只保存汇总结果
bun run batch-framework-tester.ts 5 quick-test --no-details

# 完整测试30秒，包含所有功能
bun run batch-framework-tester.ts 30 full-test --k6
```

## 🔧 环境要求

- **Node.js**: >= 18.0.0
- **Bun**: >= 1.0.0
- **K6**: 已安装（如果使用--k6选项）

## 📝 注意事项

1. **端口占用**: 确保3000-3005端口未被占用
2. **框架依赖**: 确保所有框架目录存在且可运行
3. **内存使用**: 长时间测试可能消耗较多内存
4. **结果清理**: 测试完成后会自动清理服务器资源

## 🎉 开始使用

现在你可以开始批量测试所有框架了！

```bash
# 快速开始
npm run batch:test

# 查看结果
ls test-results/batch-test/
```

所有测试结果都会保存在指定的文件夹中，方便后续分析和对比！🚀
