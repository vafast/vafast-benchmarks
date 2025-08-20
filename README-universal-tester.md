# 通用框架性能测试工具

这是一个用于测试多个Web框架性能的TypeScript工具，可以同时测试冷启动时间、请求数/秒、平均延迟等关键性能指标。

## 功能特性

✅ **支持的测试指标**:
- ❄️ 冷启动时间 - 从启动到首次响应的时间
- 📈 总请求数 - 测试期间内完成的请求总数  
- 🚀 请求数/秒 (RPS) - 每秒处理的请求数量
- ⏱️ 平均延迟 - 所有请求的平均响应时间
- 📊 延迟统计 - 最小值、最大值、P95值

✅ **支持的框架**:
- Elysia (端口 3000) - 使用 Elysia 原生 TypeBox 验证
- Hono (端口 3001) - 使用 @hono/typebox-validator  
- Express (端口 3002) - 使用 TypeCompiler.Compile() 验证中间件
- Koa (端口 3003) - 使用 TypeCompiler.Compile() 验证中间件
- Vafast-mini (端口 3004) - 使用 vafast defineRoutes + createRouteHandler TypeBox 验证
- Vafast (端口 3005) - 使用 vafast createRouteHandler 工厂模式 + TypeBox 验证
- 可轻松扩展支持更多框架

✅ **测试端点**:
- `/techempower/json` - JSON序列化测试
- `/techempower/plaintext` - 纯文本响应测试
- `/techempower/db?queries=1` - 数据库查询模拟
- `/schema/validate` - POST请求Schema验证测试

## 使用方法

### 快速开始

```bash
# 进入项目目录
cd /Users/fuguoqiang/Desktop/vafast/vafast-benchmarks

# 运行默认10秒测试
bun run universal-framework-tester.ts

# 运行自定义时长测试 (例如30秒)
bun run universal-framework-tester.ts 30
```

### 程序化使用

```typescript
import { UniversalFrameworkTester } from './universal-framework-tester';

const tester = new UniversalFrameworkTester();

// 测试所有框架
const results = await tester.runFullTest(10);

// 或测试单个框架
const elysiaResult = await tester.testFramework('elysia', 10);
```

## 输出示例

```
🚀 开始通用框架性能测试
============================================================

📋 发现 6 个可用框架:
   • Elysia (端口: 3000)
   • Hono (端口: 3001)
   • Express (端口: 3002)
   • Koa (端口: 3003)
   • Vafast-mini (端口: 3004)
   • Vafast (端口: 3005)

========================================
🔄 测试 Elysia
========================================
🔄 启动 Elysia 服务器...
✅ Elysia 启动成功，冷启动时间: 1247.83ms
🔥 开始 Elysia 性能测试 (10秒)...
📊 Elysia 完成 15432 个请求 (成功: 15432)

📊 Elysia 测试结果:
   ❄️  冷启动时间:     1247.83 ms
   📈  总请求数:       15432 个
   🚀  请求数/秒:      1543.20 RPS
   ⏱️   平均延迟:       6.48 ms
   📊  延迟范围:       2.34 - 45.67 ms
   🎯  P95延迟:        12.34 ms

================================================================================
🏆 框架性能对比报告
================================================================================

🚀 请求数/秒 (RPS) 排名:
--------------------------------------------------
🥇 Elysia          1543.20 RPS
🥈 Hono            1234.56 RPS
🥉 Express         1089.34 RPS
4. Koa              987.65 RPS

⏱️  平均延迟排名 (越低越好):
--------------------------------------------------
🥇 Hono               5.23 ms
🥈 Elysia             6.48 ms

❄️  冷启动时间排名 (越低越好):
--------------------------------------------------
🥇 Hono             896.45 ms
🥈 Elysia          1247.83 ms
```

## 添加新框架

要添加新的框架测试，只需在 `frameworkConfigs` 数组中添加新的配置：

```typescript
{
  name: "fastify",
  displayName: "Fastify",
  directory: "/path/to/fastify/framework",
  startCommand: ["node", "src/index.js"],
  port: 3002,
  testEndpoints: [
    { path: "/techempower/json", method: "GET", description: "JSON测试" },
    // 添加更多端点...
  ]
}
```

## 技术特性

- 🔧 **自动服务器管理** - 自动启动和停止框架服务器
- 🎯 **并发测试** - 使用10个并发连接进行压力测试
- ⏱️ **精确计时** - 使用高精度性能计时器
- 🛡️ **错误处理** - 完善的错误处理和超时机制
- 📊 **详细报告** - 生成完整的性能对比报告

## 注意事项

1. 确保各框架的依赖已正确安装
2. 测试前会自动检查框架是否可用
3. 每个框架使用不同端口避免冲突
4. 测试完成后会自动清理服务器进程

## 依赖要求

- Node.js >= 18.0.0
- Bun >= 1.0.0  
- TypeScript
- 各框架的相应依赖包