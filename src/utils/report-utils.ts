/**
 * 性能报告工具函数
 */

// ============================================================================
// 报告工具函数
// ============================================================================
export function formatPerformance(rps: number): string {
  if (rps >= 1_000_000) {
    return `${(rps / 1_000_000).toFixed(2)}M`;
  } else if (rps >= 1_000) {
    return `${(rps / 1_000).toFixed(2)}K`;
  } else {
    return rps.toString();
  }
}

export interface BenchmarkResult {
  name: string;
  rps: number;
  duration: number;
}

// 生成简单响应性能报告
export function generateSimpleResponseReport(results: BenchmarkResult[]): void {
  console.log("\n📊 简单响应性能测试结果:");
  console.log("-".repeat(50));

  const sortedResults = [...results].sort((a, b) => b.rps - a.rps);

  sortedResults.forEach((result, index) => {
    const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "📊";
    const rpsFormatted = formatPerformance(result.rps).padStart(8);
    console.log(`${medal} ${result.name.padEnd(30)}: ${rpsFormatted} 请求/秒`);
  });
}

// 生成验证器性能报告
export function generateValidatorReport(results: BenchmarkResult[]): void {
  console.log("\n🔍 复杂验证器性能测试结果:");
  console.log("-".repeat(50));

  const sortedResults = [...results].sort((a, b) => b.rps - a.rps);

  sortedResults.forEach((result, index) => {
    const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "📊";
    const rpsFormatted = formatPerformance(result.rps).padStart(8);
    console.log(`${medal} ${result.name.padEnd(30)}: ${rpsFormatted} 请求/秒`);
  });
}

// 生成性能分析报告
export function generatePerformanceAnalysis(
  simpleResults: BenchmarkResult[],
  validatorResults: BenchmarkResult[]
): void {
  console.log("\n" + "=".repeat(80));
  console.log("📈 综合性能分析");
  console.log("=".repeat(80));

  // 简单响应性能分析
  const sortedSimple = [...simpleResults].sort((a, b) => b.rps - a.rps);
  const fastestSimple = sortedSimple[0]!;
  const slowestSimple = sortedSimple[sortedSimple.length - 1]!;
  const simplePerformanceGap = ((fastestSimple.rps / slowestSimple.rps - 1) * 100).toFixed(1);

  console.log("\n🔍 简单响应性能分析:");
  console.log("-".repeat(50));
  console.log(`🏆 最快: ${fastestSimple.name} (${formatPerformance(fastestSimple.rps)} 请求/秒)`);
  console.log(`🐌 最慢: ${slowestSimple.name} (${formatPerformance(slowestSimple.rps)} 请求/秒)`);
  console.log(`📊 性能差距: ${simplePerformanceGap}%`);

  // 验证器性能分析
  const sortedValidator = [...validatorResults].sort((a, b) => b.rps - a.rps);
  const fastestValidator = sortedValidator[0]!;
  const slowestValidator = sortedValidator[sortedValidator.length - 1]!;
  const validatorPerformanceGap = ((fastestValidator.rps / slowestValidator.rps - 1) * 100).toFixed(
    1
  );

  console.log("\n🔍 验证器性能分析:");
  console.log("-".repeat(50));
  console.log(
    `🏆 最快: ${fastestValidator.name} (${formatPerformance(fastestValidator.rps)} 请求/秒)`
  );
  console.log(
    `🐌 最慢: ${slowestValidator.name} (${formatPerformance(slowestValidator.rps)} 请求/秒)`
  );
  console.log(`📊 性能差距: ${validatorPerformanceGap}%`);
}

// 生成vafast框架分析报告
export function generateVafastAnalysis(results: BenchmarkResult[]): void {
  console.log("\n🔍 vafast 原生框架性能分析:");
  console.log("-".repeat(50));

  const directResult = results.find((r) => r.name.includes("直接路由"));
  const factoryResult = results.find((r) => r.name.includes("工厂路由"));
  const fullResult = results.find((r) => r.name.includes("带验证版本"));

  if (directResult && factoryResult) {
    const factoryVsDirect = ((factoryResult.rps / directResult.rps - 1) * 100).toFixed(1);
    console.log(`📈 工厂路由 vs 直接路由: ${factoryVsDirect}% 性能差异`);
  }

  if (directResult && fullResult) {
    const fullVsDirect = ((fullResult.rps / directResult.rps - 1) * 100).toFixed(1);
    console.log(`📈 带验证版本 vs 直接路由: ${fullVsDirect}% 性能差异`);
  }
}

// 生成框架对比分析
export function generateFrameworkComparison(results: BenchmarkResult[]): void {
  console.log("\n🔍 与主流框架性能对比:");
  console.log("-".repeat(50));

  const elysiaResult = results.find((r) => r.name === "Elysia");
  const expressResult = results.find((r) => r.name === "Express");
  const vafastDirectResult = results.find((r) => r.name.includes("vafast原生 (直接路由)"));

  if (elysiaResult && vafastDirectResult) {
    const elysiaVsVafast = (elysiaResult.rps / vafastDirectResult.rps).toFixed(1);
    console.log(`📊 Elysia vs vafast原生直接路由: ${elysiaVsVafast}x 性能比`);
  }

  if (expressResult && vafastDirectResult) {
    const expressVsVafast = (expressResult.rps / vafastDirectResult.rps).toFixed(1);
    console.log(`📊 Express vs vafast原生直接路由: ${expressVsVafast}x 性能比`);
  }
}

// 生成使用建议
export function generateUsageRecommendations(): void {
  console.log("\n🎯 场景适用性分析:");
  console.log("-".repeat(50));
  console.log("✅ 极简路由: 使用直接路由 (性能最佳)");
  console.log("✅ 简单路由: 使用工厂路由 (平衡性能与功能)");
  console.log("✅ 复杂业务: 使用带验证版本 (功能最全)");
  console.log("💡 根据实际需求选择合适的实现方式");
}

// 生成内存使用建议
export function generateMemoryRecommendations(memoryPercentage: number): void {
  console.log("\n💡 内存使用建议:");
  console.log("-".repeat(50));
  if (memoryPercentage > 80) {
    console.log("⚠️  内存使用率较高，建议增加系统内存或优化代码");
  } else if (memoryPercentage > 60) {
    console.log("📊 内存使用率中等，建议监控内存使用情况");
  } else {
    console.log("✅ 内存使用率正常");
  }
}
