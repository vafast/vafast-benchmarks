/**
 * 性能报告工具函数 - 开源项目标准
 */

export interface BenchmarkResult {
  name: string;
  rps: number;
  duration: number;
}

// 格式化性能数据
export function formatPerformance(rps: number): string {
  if (rps >= 1_000_000) {
    return `${(rps / 1_000_000).toFixed(2)}M`;
  } else if (rps >= 1_000) {
    return `${(rps / 1_000).toFixed(2)}K`;
  } else {
    return rps.toString();
  }
}

// 格式化时间
export function formatTime(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`;
  } else if (ms >= 1) {
    return `${ms.toFixed(2)}ms`;
  } else {
    return `${(ms * 1000).toFixed(2)}μs`;
  }
}

// 格式化内存
export function formatMemory(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
  } else if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(2)}KB`;
  } else {
    return `${bytes}B`;
  }
}

// 生成简单响应性能报告
export function generateSimpleResponseReport(results: BenchmarkResult[]): void {
  console.log("\n## 简单响应性能测试");
  console.log("| 框架 | 请求/秒 | 平均耗时 | 总耗时 | 排名 |");
  console.log("|------|----------|----------|--------|------|");

  const sortedResults = [...results].sort((a, b) => b.rps - a.rps);

  sortedResults.forEach((result, index) => {
    const performance =
      index === 0 ? "🥇 第一" : index === 1 ? "🥈 第二" : index === 2 ? "🥉 第三" : "📊";
    const rpsFormatted = formatPerformance(result.rps);
    const avgTime = formatTime(result.duration / (result.rps * (result.duration / 1000)));
    const totalTime = formatTime(result.duration);
    
    console.log(
      `| ${result.name.padEnd(20)} | ${rpsFormatted.padStart(12)} | ${avgTime.padStart(12)} | ${totalTime.padStart(10)} | ${performance.padStart(11)} |`
    );
  });
}

// 生成验证器性能报告
export function generateValidatorReport(results: BenchmarkResult[]): void {
  console.log("\n## 验证器性能测试");
  console.log("| 框架 | 请求/秒 | 平均耗时 | 总耗时 | 排名 |");
  console.log("|------|----------|----------|--------|------|");

  const sortedResults = [...results].sort((a, b) => b.rps - a.rps);

  sortedResults.forEach((result, index) => {
    const performance =
      index === 0 ? "🥇 第一" : index === 1 ? "🥈 第二" : index === 2 ? "🥉 第三" : "📊";
    const rpsFormatted = formatPerformance(result.rps);
    const avgTime = formatTime(result.duration / (result.rps * (result.duration / 1000)));
    const totalTime = formatTime(result.duration);
    
    console.log(
      `| ${result.name.padEnd(20)} | ${rpsFormatted.padStart(12)} | ${avgTime.padStart(12)} | ${totalTime.padStart(10)} | ${performance.padStart(11)} |`
    );
  });
}

// 生成vafast框架分析
export function generateVafastAnalysis(results: BenchmarkResult[]): void {
  const directResult = results.find((r) => r.name.includes("直接路由"));
  const factoryResult = results.find((r) => r.name.includes("工厂路由"));
  const fullResult = results.find((r) => r.name.includes("带验证版本"));

  if (directResult && factoryResult && fullResult) {
    console.log("\n## vafast 性能分析");
    console.log("| 实现方式 | 性能 | 开销 | 平均耗时 |");
    console.log("|----------|------|------|----------|");

    const factoryOverhead = ((directResult.rps / factoryResult.rps - 1) * 100).toFixed(1);
    const fullOverhead = ((directResult.rps / fullResult.rps - 1) * 100).toFixed(1);
    
    const directAvgTime = formatTime(directResult.duration / (directResult.rps * (directResult.duration / 1000)));
    const factoryAvgTime = formatTime(factoryResult.duration / (factoryResult.rps * (factoryResult.duration / 1000)));
    const fullAvgTime = formatTime(fullResult.duration / (fullResult.rps * (fullResult.duration / 1000)));

    console.log(
      `| 直接路由      | ${formatPerformance(directResult.rps).padStart(11)} | 基准   | ${directAvgTime.padStart(8)} |`
    );
    console.log(
      `| 工厂路由      | ${formatPerformance(factoryResult.rps).padStart(11)} | +${factoryOverhead}% | ${factoryAvgTime.padStart(8)} |`
    );
    console.log(
      `| 完整验证      | ${formatPerformance(fullResult.rps).padStart(11)} | +${fullOverhead}% | ${fullAvgTime.padStart(8)} |`
    );
  }
}

// 生成框架对比
export function generateFrameworkComparison(results: BenchmarkResult[]): void {
  const vafastDirect = results.find((r) => r.name.includes("vafast原生 (直接路由)"));
  const elysia = results.find((r) => r.name.includes("Elysia"));
  const express = results.find((r) => r.name.includes("Express"));

  if (vafastDirect && elysia && express) {
    console.log("\n## 框架性能对比");
    console.log("| 框架 | 相对性能 | 平均耗时 |");
    console.log("|------|-----------|----------|");

    const elysiaRatio = (elysia.rps / vafastDirect.rps).toFixed(2);
    const expressRatio = (express.rps / vafastDirect.rps).toFixed(2);
    
    const vafastAvgTime = formatTime(vafastDirect.duration / (vafastDirect.rps * (vafastDirect.duration / 1000)));
    const elysiaAvgTime = formatTime(elysia.duration / (elysia.rps * (elysia.duration / 1000)));
    const expressAvgTime = formatTime(express.duration / (express.rps * (express.duration / 1000)));

    console.log(`| Elysia    | ${elysiaRatio.padStart(9)}x | ${elysiaAvgTime.padStart(8)} |`);
    console.log(`| Express   | ${expressRatio.padStart(9)}x | ${expressAvgTime.padStart(8)} |`);
    console.log(`| vafast    | 1.00x      | ${vafastAvgTime.padStart(8)} |`);
  }
}

// 生成使用建议
export function generateUsageRecommendations(): void {
  console.log("\n## 使用建议");
  console.log("- **极简路由**: 使用直接路由获得最佳性能");
  console.log("- **简单路由**: 使用工厂路由平衡性能和功能");
  console.log("- **复杂业务**: 使用完整验证获得全部功能");
}

// 生成内存建议
export function generateMemoryRecommendations(percentage: number): void {
  console.log("\n## 内存状态");
  if (percentage > 80) {
    console.log("⚠️  内存使用率较高 - 建议优化");
  } else if (percentage > 60) {
    console.log("📊 内存使用率中等 - 建议监控");
  } else {
    console.log("✅ 内存使用率正常");
  }
}

// 生成测试摘要
export function generateTestSummary(results: BenchmarkResult[], testType: string): void {
  console.log(`\n## ${testType} 测试摘要`);
  
  const totalRequests = results.reduce((sum, r) => sum + (r.rps * (r.duration / 1000)), 0);
  const totalTime = results.reduce((sum, r) => sum + r.duration, 0);
  const fastest = results.reduce((fastest, r) => (r.rps > fastest.rps ? r : fastest));
  const slowest = results.reduce((slowest, r) => (r.rps < slowest.rps ? r : slowest));
  
  console.log(`| 指标 | 数值 |`);
  console.log(`|------|------|`);
  console.log(`| 总请求数 | ${totalRequests.toLocaleString()} |`);
  console.log(`| 总耗时 | ${formatTime(totalTime)} |`);
  console.log(`| 最快 | ${fastest.name} (${formatPerformance(fastest.rps)}) |`);
  console.log(`| 最慢 | ${slowest.name} (${formatPerformance(slowest.rps)}) |`);
  console.log(`| 性能差距 | ${((fastest.rps / slowest.rps - 1) * 100).toFixed(1)}% |`);
}
