/**
 * 验证器性能测试
 * 对比主流框架与 vafast 原生框架的验证器性能
 */

// 导入验证器配置
import {
  expressValidatorApp,
  vafastValidatorRoutes,
  elysiaValidatorApp,
  honoValidatorApp,
} from "./config/validator-config.js";

// 导入工具函数
import {
  TEST_CONFIG,
  benchmark,
  logMemoryUsage,
  forceGarbageCollection,
} from "./utils/benchmark-utils.js";

// 导入报告函数
import { generateValidatorReport, BenchmarkResult } from "./utils/report-utils.js";

// ============================================================================
// 验证器性能测试
// ============================================================================
async function runValidatorBenchmark() {
  console.log("🚀 开始验证器性能测试");
  console.log("=".repeat(80));
  console.log("💡 测试目标:");
  console.log("   • 复杂验证器性能测试");
  console.log("   • 对比主流框架与 vafast 原生框架");
  console.log("   • 验证框架优化效果（单线程测试）");

  // 记录初始内存使用
  logMemoryUsage("测试开始前");

  console.log(
    "\n📋 测试配置: " +
      TEST_CONFIG.validatorIterations.toLocaleString() +
      " 次请求, 包含 TypeBox 验证器"
  );

  console.log("\n🔍 验证器性能测试结果:");
  console.log("-".repeat(50));

  const expressValidatorResult = await benchmark(
    "Express (TypeBox验证器)",
    async (req) => {
      // 修复：测试真实的 Express 应用，而不是直接调用验证器
      const body = await req.json();

      // 模拟 Express 请求处理
      const expressReq = {
        body: body,
        url: req.url,
        method: req.method,
        headers: Object.fromEntries(req.headers.entries()),
      } as any;

      const expressRes = {
        statusCode: 200,
        headers: {} as any,
        body: "",
        status: function (code: number) {
          this.statusCode = code;
          return this;
        },
        json: function (data: any) {
          this.body = JSON.stringify(data);
          return this;
        },
      } as any;

      // 调用真实的 Express 应用
      expressValidatorApp._router.stack
        .find((layer: any) => layer.route && layer.route.path === "/" && layer.route.methods.post)
        ?.handle(expressReq, expressRes, () => {});

      return new Response(expressRes.body, {
        status: expressRes.statusCode,
        headers: expressRes.headers,
      });
    },
    TEST_CONFIG.validatorIterations
  );

  const vafastValidatorResult = await benchmark(
    "vafast原生 (TypeBox验证器)",
    async (req) => {
      const route = vafastValidatorRoutes[0]!;
      return await route.handler(req);
    },
    TEST_CONFIG.validatorIterations
  );

  const elysiaValidatorResult = await benchmark(
    "Elysia (TypeBox验证器)",
    async (req) => {
      return await elysiaValidatorApp.handle(req);
    },
    TEST_CONFIG.validatorIterations
  );

  const honoValidatorResult = await benchmark(
    "Hono (TypeBox验证器)",
    async (req) => {
      return await honoValidatorApp.fetch(req);
    },
    TEST_CONFIG.validatorIterations
  );

  // 记录测试后内存使用
  logMemoryUsage("测试完成后");
  forceGarbageCollection();

  // ============================================================================
  // 性能报告
  // ============================================================================
  console.log("\n" + "=".repeat(80));
  console.log("🏆 验证器性能测试报告");
  console.log("=".repeat(80));

  // 验证器测试结果
  const validatorResults: BenchmarkResult[] = [
    expressValidatorResult,
    vafastValidatorResult,
    elysiaValidatorResult,
    honoValidatorResult,
  ];

  generateValidatorReport(validatorResults);

  console.log("\n📊 验证器性能测试完成");
}

// 导出函数供其他模块使用
export { runValidatorBenchmark };

// 如果直接运行此文件，则执行测试
if (
  typeof require !== "undefined" ||
  (typeof process !== "undefined" && process.argv[1] === import.meta.url)
) {
  runValidatorBenchmark();
}
