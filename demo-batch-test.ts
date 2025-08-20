import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

interface PerformanceMetrics {
  framework: string;
  coldStartTime: number;
  totalRequests: number;
  requestsPerSecond: number;
  averageLatency: number;
  minLatency: number;
  maxLatency: number;
  p95Latency: number;
  testDuration: number;
  errorRate: number;
  memoryUsage?: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
}

interface BatchTestConfig {
  testDuration: number;
  outputDir: string;
  includeK6: boolean;
  saveDetailedResults: boolean;
  saveComparisonReport: boolean;
}

class DemoBatchTester {
  private config: BatchTestConfig;

  constructor(config: BatchTestConfig) {
    this.config = config;
  }

  /**
   * 创建输出目录
   */
  private createOutputDirectory(): void {
    if (!existsSync(this.config.outputDir)) {
      mkdirSync(this.config.outputDir, { recursive: true });
      console.log(`📁 创建输出目录: ${this.config.outputDir}`);
    }
  }

  /**
   * 生成模拟的测试结果
   */
  private generateMockResults(): PerformanceMetrics[] {
    const frameworks = ["elysia", "hono", "express", "koa", "vafast-mini", "vafast"];

    return frameworks.map((framework, index) => {
      // 生成一些变化的性能数据
      const baseRPS = 15000 + index * 2000 + Math.random() * 5000;
      const baseLatency = 0.1 + index * 0.05 + Math.random() * 0.1;
      const baseColdStart = 0.5 + index * 0.2 + Math.random() * 0.3;

      return {
        framework,
        coldStartTime: baseColdStart,
        totalRequests: Math.floor(baseRPS * this.config.testDuration),
        requestsPerSecond: baseRPS,
        averageLatency: baseLatency,
        minLatency: baseLatency * 0.5,
        maxLatency: baseLatency * 3,
        p95Latency: baseLatency * 1.5,
        testDuration: this.config.testDuration,
        errorRate: Math.random() * 0.1,
        memoryUsage: {
          heapUsed: 30 + Math.random() * 40,
          heapTotal: 50 + Math.random() * 60,
          external: 10 + Math.random() * 20,
          rss: 80 + Math.random() * 50,
        },
      };
    });
  }

  /**
   * 保存单个框架的详细结果
   */
  private saveFrameworkResult(framework: string, result: PerformanceMetrics): void {
    if (!this.config.saveDetailedResults) return;

    const filename = `${framework}-detailed-results.json`;
    const filepath = join(this.config.outputDir, filename);

    const detailedResult = {
      framework: result.framework,
      timestamp: new Date().toISOString(),
      testDuration: this.config.testDuration,
      metrics: {
        coldStart: {
          emoji: "👑",
          name: "冷启动",
          value: `${result.coldStartTime.toFixed(2)} ms`,
          description: `${result.coldStartTime.toFixed(
            2
          )} ms. 无延迟，无妥协。冷启动王者之冠属于我们。`,
        },
        requestsPerSecond: {
          emoji: "⚡️",
          name: "每秒请求数",
          value: `${result.requestsPerSecond.toFixed(2)} rps`,
          description: "为瞬时流量而生 — 无需预热。",
        },
        avgLatency: {
          emoji: "📉",
          name: "平均延迟",
          value: `${result.averageLatency.toFixed(2)} ms`,
          description: "压力之下依然迅捷。始终如一。",
        },
        totalRequests: {
          emoji: "🎯",
          name: "总请求数",
          value: `${result.totalRequests} req / ${this.config.testDuration}s`,
          description: `在${this.config.testDuration}秒内完成的总请求数`,
        },
        performance: {
          minLatency: result.minLatency,
          maxLatency: result.maxLatency,
          p95Latency: result.p95Latency,
          errorRate: result.errorRate,
          memoryUsage: result.memoryUsage,
        },
      },
    };

    writeFileSync(filepath, JSON.stringify(detailedResult, null, 2), "utf8");
    console.log(`💾 保存详细结果: ${filepath}`);
  }

  /**
   * 保存所有框架的汇总结果
   */
  private saveSummaryResults(results: PerformanceMetrics[]): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `batch-test-summary-${timestamp}.json`;
    const filepath = join(this.config.outputDir, filename);

    const summary = {
      testInfo: {
        timestamp: new Date().toISOString(),
        testDuration: this.config.testDuration,
        totalFrameworks: results.length,
        outputDirectory: this.config.outputDir,
        note: "这是演示数据，用于测试批量测试器功能",
      },
      results: results.map((result) => ({
        framework: result.framework,
        coldStartTime: result.coldStartTime,
        totalRequests: result.totalRequests,
        requestsPerSecond: result.requestsPerSecond,
        averageLatency: result.averageLatency,
        minLatency: result.minLatency,
        maxLatency: result.maxLatency,
        p95Latency: result.p95Latency,
        errorRate: result.errorRate,
        memoryUsage: result.memoryUsage,
      })),
      rankings: {
        byRPS: results
          .sort((a, b) => b.requestsPerSecond - a.requestsPerSecond)
          .map((r, i) => ({ rank: i + 1, framework: r.framework, rps: r.requestsPerSecond })),
        byLatency: results
          .sort((a, b) => a.averageLatency - b.averageLatency)
          .map((r, i) => ({ rank: i + 1, framework: r.framework, latency: r.averageLatency })),
        byColdStart: results
          .sort((a, b) => a.coldStartTime - b.coldStartTime)
          .map((r, i) => ({ rank: i + 1, framework: r.framework, coldStart: r.coldStartTime })),
      },
    };

    writeFileSync(filepath, JSON.stringify(summary, null, 2), "utf8");
    console.log(`💾 保存汇总结果: ${filepath}`);
  }

  /**
   * 保存对比报告
   */
  private saveComparisonReport(results: PerformanceMetrics[]): void {
    if (!this.config.saveComparisonReport) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `comparison-report-${timestamp}.md`;
    const filepath = join(this.config.outputDir, filename);

    let report = `# 🏆 框架性能对比报告 (演示版)\n\n`;
    report += `**测试时间**: ${new Date().toISOString()}\n`;
    report += `**测试时长**: ${this.config.testDuration} 秒\n`;
    report += `**测试框架数量**: ${results.length}\n`;
    report += `**注意**: 这是演示数据，用于测试批量测试器功能\n\n`;

    // RPS 排名
    const sortedByRps = [...results].sort((a, b) => b.requestsPerSecond - a.requestsPerSecond);
    report += `## 🚀 请求数/秒 (RPS) 排名\n\n`;
    report += `| 排名 | 框架 | RPS |\n`;
    report += `|------|------|-----|\n`;
    sortedByRps.forEach((result, index) => {
      const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}.`;
      report += `| ${medal} | ${result.framework} | ${result.requestsPerSecond.toFixed(2)} |\n`;
    });

    // 延迟排名
    const sortedByLatency = [...results].sort((a, b) => a.averageLatency - b.averageLatency);
    report += `\n## ⏱️ 平均延迟排名 (越低越好)\n\n`;
    report += `| 排名 | 框架 | 平均延迟 |\n`;
    report += `|------|------|----------|\n`;
    sortedByLatency.forEach((result, index) => {
      const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}.`;
      report += `| ${medal} | ${result.framework} | ${result.averageLatency.toFixed(2)} ms |\n`;
    });

    // 冷启动排名
    const sortedByColdStart = [...results].sort((a, b) => a.coldStartTime - b.coldStartTime);
    report += `\n## ❄️ 冷启动时间排名 (越低越好)\n\n`;
    report += `| 排名 | 框架 | 冷启动时间 |\n`;
    report += `|------|------|------------|\n`;
    sortedByColdStart.forEach((result, index) => {
      const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}.`;
      report += `| ${medal} | ${result.framework} | ${result.coldStartTime.toFixed(2)} ms |\n`;
    });

    // 详细数据表格
    report += `\n## 📊 详细性能数据\n\n`;
    report += `| 框架 | 冷启动 | 总请求数 | RPS | 平均延迟 | P95延迟 | 错误率 |\n`;
    report += `|------|---------|----------|-----|----------|----------|--------|\n`;
    results.forEach((result) => {
      report += `| ${result.framework} | ${result.coldStartTime.toFixed(2)}ms | ${
        result.totalRequests
      } | ${result.requestsPerSecond.toFixed(2)} | ${result.averageLatency.toFixed(
        2
      )}ms | ${result.p95Latency.toFixed(2)}ms | ${result.errorRate.toFixed(2)}% |\n`;
    });

    // 总结
    report += `\n## 📝 测试总结\n\n`;
    report += `- **最高RPS**: ${Math.max(...results.map((r) => r.requestsPerSecond)).toFixed(2)} (${
      sortedByRps[0].framework
    })\n`;
    report += `- **最低延迟**: ${Math.min(...results.map((r) => r.averageLatency)).toFixed(
      2
    )} ms (${sortedByLatency[0].framework})\n`;
    report += `- **最快冷启动**: ${Math.min(...results.map((r) => r.coldStartTime)).toFixed(
      2
    )} ms (${sortedByColdStart[0].framework})\n`;

    writeFileSync(filepath, report, "utf8");
    console.log(`💾 保存对比报告: ${filepath}`);
  }

  /**
   * 打印对比报告
   */
  private printComparisonReport(results: PerformanceMetrics[]): void {
    if (results.length === 0) {
      console.log("❌ 没有测试结果可供对比");
      return;
    }

    console.log(`\n${"=".repeat(80)}`);
    console.log("🏆 框架性能对比报告 (演示版)");
    console.log(`${"=".repeat(80)}`);

    const sortedByRps = [...results].sort((a, b) => b.requestsPerSecond - a.requestsPerSecond);

    console.log("\n🚀 请求数/秒 (RPS) 排名:");
    console.log("-".repeat(50));
    sortedByRps.forEach((result, index) => {
      const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}.`;
      console.log(
        `${medal} ${result.framework.padEnd(15)} ${result.requestsPerSecond
          .toFixed(2)
          .padStart(8)} RPS`
      );
    });

    const sortedByLatency = [...results].sort((a, b) => a.averageLatency - b.averageLatency);

    console.log("\n⏱️  平均延迟排名 (越低越好):");
    console.log("-".repeat(50));
    sortedByLatency.forEach((result, index) => {
      const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}.`;
      console.log(
        `${medal} ${result.framework.padEnd(15)} ${result.averageLatency.toFixed(2).padStart(8)} ms`
      );
    });

    const sortedByColdStart = [...results].sort((a, b) => a.coldStartTime - b.coldStartTime);

    console.log("\n❄️  冷启动时间排名 (越低越好):");
    console.log("-".repeat(50));
    sortedByColdStart.forEach((result, index) => {
      const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}.`;
      console.log(
        `${medal} ${result.framework.padEnd(15)} ${result.coldStartTime.toFixed(2).padStart(8)} ms`
      );
    });

    console.log(`\n${"=".repeat(80)}`);
    console.log("📝 测试总结:");
    console.log(`   • 测试框架数量: ${results.length}`);
    console.log(`   • 最高RPS: ${Math.max(...results.map((r) => r.requestsPerSecond)).toFixed(2)}`);
    console.log(
      `   • 最低延迟: ${Math.min(...results.map((r) => r.averageLatency)).toFixed(2)} ms`
    );
    console.log(
      `   • 最快冷启动: ${Math.min(...results.map((r) => r.coldStartTime)).toFixed(2)} ms`
    );
    console.log(`   • 注意: 这是演示数据，用于测试批量测试器功能`);
    console.log(`${"=".repeat(80)}\n`);
  }

  /**
   * 运行演示批量测试
   */
  async runDemoBatchTest(): Promise<PerformanceMetrics[]> {
    console.log("🚀 开始演示批量框架性能测试");
    console.log("=".repeat(60));
    console.log(`📋 测试配置:`);
    console.log(`   • 测试时长: ${this.config.testDuration} 秒`);
    console.log(`   • 输出目录: ${this.config.outputDir}`);
    console.log(`   • 包含K6测试: ${this.config.includeK6 ? "是" : "否"}`);
    console.log(`   • 保存详细结果: ${this.config.saveDetailedResults ? "是" : "否"}`);
    console.log(`   • 保存对比报告: ${this.config.saveComparisonReport ? "是" : "否"}`);
    console.log(`   • 注意: 这是演示版本，使用模拟数据`);
    console.log("=".repeat(60));

    // 创建输出目录
    this.createOutputDirectory();

    try {
      // 生成模拟结果
      console.log("\n🧪 生成演示测试结果...");
      const results = this.generateMockResults();

      if (results.length === 0) {
        console.log("❌ 没有获得测试结果");
        return results;
      }

      // 保存结果
      console.log("\n💾 保存测试结果...");
      results.forEach((result) => {
        this.saveFrameworkResult(result.framework, result);
      });

      // 保存汇总结果
      this.saveSummaryResults(results);

      // 保存对比报告
      this.saveComparisonReport(results);

      // 打印对比报告
      console.log("\n📊 测试完成！打印对比报告...");
      this.printComparisonReport(results);

      console.log(`\n🎉 演示批量测试完成！所有结果已保存到: ${this.config.outputDir}`);
      console.log(
        "💡 这是演示版本，使用模拟数据。要运行真实测试，请使用 batch-framework-tester.ts"
      );

      return results;
    } catch (error) {
      console.error("❌ 演示批量测试执行失败:", error);
      throw error;
    }
  }
}

// 主执行函数
async function main() {
  const config: BatchTestConfig = {
    testDuration: process.argv[2] ? parseInt(process.argv[2]) : 10,
    outputDir: process.argv[3] || "test-results/demo-batch-test",
    includeK6: process.argv.includes("--k6"),
    saveDetailedResults: !process.argv.includes("--no-details"),
    saveComparisonReport: !process.argv.includes("--no-report"),
  };

  const demoTester = new DemoBatchTester(config);

  try {
    await demoTester.runDemoBatchTest();
  } catch (error) {
    console.error("演示批量测试执行失败:", error);
    process.exit(1);
  }
}

// 如果直接运行此文件则执行测试
if (require.main === module) {
  main();
}

export { DemoBatchTester, BatchTestConfig, PerformanceMetrics };
