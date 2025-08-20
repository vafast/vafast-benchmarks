/**
 * 简单响应性能测试
 * 对比主流框架与 vafast 原生框架的简单响应性能
 */

// 导入简单响应配置
import {
  nativeResponse,
  elysiaApp,
  honoApp,
  handleExpressRequest,
  handleKoaRequest,
  vafastRoutesDirect,
  vafastRoutesFactory,
} from "./config/simple-response-config.js";

// 导入工具函数
import {
  TEST_CONFIG,
  benchmark,
  logMemoryUsage,
  forceGarbageCollection,
} from "./utils/benchmark-utils.js";

// 导入报告函数
import {
  generateSimpleResponseReport,
  generateVafastAnalysis,
  generateFrameworkComparison,
  generateUsageRecommendations,
  BenchmarkResult,
} from "./utils/report-utils.js";

// 测试结果接口（与 run-all-benchmarks.ts 保持一致）
interface TestResult {
  name: string;
  rps: number;
  duration: number;
}

// ============================================================================
// 简单响应性能测试
// ============================================================================
async function runSimpleResponseBenchmark(): Promise<TestResult[]> {
  console.log("🚀 开始简单响应性能测试");
  console.log("=".repeat(80));
  console.log("💡 测试目标:");
  console.log("   • 简单响应性能测试");
  console.log("   • 对比主流框架与 vafast 原生框架");
  console.log("   • 验证框架优化效果（单线程测试）");

  // 记录初始内存使用
  logMemoryUsage("测试开始前");

  console.log("\n📋 测试配置: " + TEST_CONFIG.iterations.toLocaleString() + " 次迭代");

  // 单线程性能测试
  console.log("\n🔍 单线程性能测试结果:");
  console.log("-".repeat(50));

  const nativeResult = await benchmark("原生 Response", async () => {
    return nativeResponse();
  });

  const elysiaResult = await benchmark("Elysia", async (req) => {
    return await elysiaApp.handle(req);
  });

  const honoResult = await benchmark("Hono", async (req) => {
    return await honoApp.fetch(req);
  });

  const expressResult = await benchmark("Express", handleExpressRequest);

  const koaResult = await benchmark("Koa", handleKoaRequest);

  const vafastDirectResult = await benchmark("vafast原生 (直接路由)", async () => {
    const route = vafastRoutesDirect[0]!;
    return await route.handler();
  });

  const vafastFactoryResult = await benchmark("vafast原生 (工厂路由)", async (req) => {
    const route = vafastRoutesFactory[0]!;
    return await route.handler(req);
  });

  // 记录测试后内存使用
  logMemoryUsage("测试完成后");
  forceGarbageCollection();

  // ============================================================================
  // 性能报告
  // ============================================================================
  console.log("\n" + "=".repeat(80));
  console.log("🏆 简单响应性能测试报告");
  console.log("=".repeat(80));

  // 简单响应测试结果
  const simpleResults: BenchmarkResult[] = [
    nativeResult,
    vafastDirectResult,
    vafastFactoryResult,
    elysiaResult,
    honoResult,
    expressResult,
    koaResult,
  ];

  generateSimpleResponseReport(simpleResults);

  // vafast 原生框架性能分析
  generateVafastAnalysis(simpleResults);

  // 与主流框架对比
  generateFrameworkComparison(simpleResults);

  // 场景适用性分析
  generateUsageRecommendations();

  console.log("\n📊 简单响应性能测试完成");

  // 转换并返回测试结果
  const testResults: TestResult[] = simpleResults.map((result) => ({
    name: result.name,
    rps: result.rps,
    duration: result.duration,
  }));

  return testResults;
}

// 导出函数供其他模块使用
export { runSimpleResponseBenchmark };

// 如果直接运行此文件，则执行测试
if (
  typeof require !== "undefined" ||
  (typeof process !== "undefined" && process.argv[1] === import.meta.url)
) {
  runSimpleResponseBenchmark();
}
