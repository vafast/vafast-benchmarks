import { UniversalFrameworkTester, PerformanceMetrics } from "./universal-framework-tester";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

interface BatchTestConfig {
  testDuration: number;
  outputDir: string;
  includeK6: boolean;
  saveDetailedResults: boolean;
  saveComparisonReport: boolean;
  manualStart: boolean; // 新增：手动启动模式
}

class BatchFrameworkTester {
  private tester: UniversalFrameworkTester;
  private config: BatchTestConfig;

  constructor(config: BatchTestConfig) {
    this.tester = new UniversalFrameworkTester();
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
        manualStart: this.config.manualStart,
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

    let report = `# 🏆 框架性能对比报告\n\n`;
    report += `**测试时间**: ${new Date().toISOString()}\n`;
    report += `**测试时长**: ${this.config.testDuration} 秒\n`;
    report += `**测试框架数量**: ${results.length}\n`;
    report += `**启动模式**: ${this.config.manualStart ? "手动启动" : "自动启动"}\n\n`;

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
   * 运行K6测试（如果启用）
   */
  private async runK6Tests(): Promise<void> {
    if (!this.config.includeK6) return;

    console.log("\n🔧 运行K6性能测试...");

    try {
      const { spawn } = require("child_process");

      // 运行k6测试
      const k6Process = spawn("k6", ["run", "k6-test-config.js"], {
        stdio: "pipe",
      });

      return new Promise((resolve, reject) => {
        let output = "";

        k6Process.stdout?.on("data", (data: Buffer) => {
          const text = data.toString();
          output += text;
          process.stdout.write(text);
        });

        k6Process.stderr?.on("data", (data: Buffer) => {
          const text = data.toString();
          output += text;
          process.stderr.write(text);
        });

        k6Process.on("close", (code: number) => {
          if (code === 0) {
            console.log("✅ K6测试完成");
            resolve();
          } else {
            console.log(`❌ K6测试失败，退出码: ${code}`);
            reject(new Error(`K6测试失败，退出码: ${code}`));
          }
        });
      });
    } catch (error) {
      console.error("❌ K6测试执行失败:", error);
    }
  }

  /**
   * 运行完整的批量测试
   */
  async runBatchTest(): Promise<PerformanceMetrics[]> {
    console.log("🚀 开始批量框架性能测试");
    console.log("=".repeat(60));
    console.log(`📋 测试配置:`);
    console.log(`   • 测试时长: ${this.config.testDuration} 秒`);
    console.log(`   • 输出目录: ${this.config.outputDir}`);
    console.log(`   • 包含K6测试: ${this.config.includeK6 ? "是" : "否"}`);
    console.log(`   • 保存详细结果: ${this.config.saveDetailedResults ? "是" : "否"}`);
    console.log(`   • 保存对比报告: ${this.config.saveComparisonReport ? "是" : "否"}`);
    console.log(`   • 启动模式: ${this.config.manualStart ? "手动启动" : "自动启动"}`);
    console.log("=".repeat(60));

    if (this.config.manualStart) {
      console.log("\n⚠️  手动启动模式：请确保所有框架服务已手动启动");
      console.log("📋 需要启动的服务端口:");
      console.log("   • Elysia: 3000");
      console.log("   • Hono: 3001");
      console.log("   • Express: 3002");
      console.log("   • Koa: 3003");
      console.log("   • Vafast: 3004");
      console.log("   • Vafast-mini: 3005");
      console.log("\n⏳ 等待5秒后开始测试...");
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    // 创建输出目录
    this.createOutputDirectory();

    try {
      // 运行框架测试
      console.log("\n🧪 开始框架性能测试...");
      const results = await this.tester.testAllFrameworks(
        this.config.testDuration,
        this.config.manualStart
      );

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

      // 运行K6测试（如果启用）
      if (this.config.includeK6) {
        await this.runK6Tests();
      }

      // 打印对比报告
      console.log("\n📊 测试完成！打印对比报告...");
      this.tester.printComparisonReport(results);

      console.log(`\n🎉 批量测试完成！所有结果已保存到: ${this.config.outputDir}`);

      return results;
    } catch (error) {
      console.error("❌ 批量测试执行失败:", error);
      throw error;
    } finally {
      // 清理资源（仅在自动启动模式下）
      if (!this.config.manualStart) {
        console.log("\n🧹 清理资源...");
        await this.tester.stopAllServers();
        console.log("✅ 资源清理完成");
      } else {
        console.log("\n⚠️  手动启动模式：请手动停止服务");
      }
    }
  }
}

// 主执行函数
async function main() {
  const config: BatchTestConfig = {
    testDuration: process.argv[2] ? parseInt(process.argv[2]) : 10,
    outputDir: process.argv[3] || "test-results/batch-test",
    includeK6: process.argv.includes("--k6"),
    saveDetailedResults: !process.argv.includes("--no-details"),
    saveComparisonReport: !process.argv.includes("--no-report"),
    manualStart: process.argv.includes("--manual"), // 新增：手动启动模式
  };

  const batchTester = new BatchFrameworkTester(config);

  try {
    await batchTester.runBatchTest();
  } catch (error) {
    console.error("批量测试执行失败:", error);
    process.exit(1);
  }
}

// 如果直接运行此文件则执行测试
if (require.main === module) {
  main();
}

export { BatchFrameworkTester, BatchTestConfig };
