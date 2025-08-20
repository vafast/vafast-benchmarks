import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import * as http from "http";
import { performance } from "perf_hooks";

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

interface FrameworkConfig {
  name: string;
  displayName: string;
  port: number;
}

interface BatchTestConfig {
  testDuration: number;
  outputDir: string;
  includeK6: boolean;
  saveDetailedResults: boolean;
  saveComparisonReport: boolean;
  manualStart: boolean;
}

interface TestEndpoint {
  path: string;
  method: "GET" | "POST";
  body?: any;
  description: string;
}

class BatchFrameworkTester {
  private config: BatchTestConfig;

  // 框架配置
  private readonly frameworkConfigs: FrameworkConfig[] = [
    { name: "elysia", displayName: "Elysia", port: 3000 },
    { name: "hono", displayName: "Hono", port: 3001 },
    { name: "express", displayName: "Express", port: 3002 },
    { name: "koa", displayName: "Koa", port: 3003 },
    { name: "vafast", displayName: "Vafast", port: 3004 },
    { name: "vafast-mini", displayName: "Vafast-Mini", port: 3005 },
  ];

  // 测试端点
  private readonly testEndpoints: TestEndpoint[] = [
    { path: "/techempower/json", method: "GET", description: "JSON序列化测试" },
    { path: "/techempower/plaintext", method: "GET", description: "纯文本响应测试" },
    { path: "/techempower/db?queries=1", method: "GET", description: "数据库查询模拟" },
    {
      path: "/schema/validate",
      method: "POST",
      description: "Schema验证测试",
      body: {
        user: {
          name: "Test User",
          phone: "13800138000",
          age: 25,
          active: true,
          tags: ["test", "user"],
          preferences: {
            theme: "light",
            language: "zh-CN",
          },
        },
        metadata: {
          version: "1.0.0",
          timestamp: new Date().toISOString(),
        },
      },
    },
  ];

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
   * 发送HTTP请求并测量延迟
   */
  private async sendRequest(
    endpoint: TestEndpoint,
    port: number
  ): Promise<{ latency: number; success: boolean }> {
    return new Promise((resolve) => {
      const startTime = performance.now();
      const requestBody = endpoint.body ? JSON.stringify(endpoint.body) : null;

      const options = {
        hostname: "localhost",
        port: port,
        path: endpoint.path,
        method: endpoint.method,
        headers: {
          "Content-Type": "application/json",
          Connection: "keep-alive",
          ...(requestBody && { "Content-Length": Buffer.byteLength(requestBody) }),
        },
        timeout: 5000,
        agent: false,
      };

      const req = http.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          const latency = performance.now() - startTime;
          resolve({ latency, success: res.statusCode! >= 200 && res.statusCode! < 300 });
        });
      });

      req.on("error", () => {
        const latency = performance.now() - startTime;
        resolve({ latency, success: false });
      });

      req.on("timeout", () => {
        req.destroy();
        const latency = performance.now() - startTime;
        resolve({ latency, success: false });
      });

      if (requestBody && endpoint.method === "POST") {
        req.write(requestBody);
      }

      req.end();
    });
  }

  /**
   * 健康检查
   */
  private async healthCheck(port: number): Promise<boolean> {
    try {
      const result = await this.sendRequest(this.testEndpoints[0], port);
      return result.success;
    } catch {
      return false;
    }
  }

  /**
   * 执行性能测试
   */
  private async runPerformanceTest(
    config: FrameworkConfig,
    testDuration: number
  ): Promise<{
    totalRequests: number;
    averageLatency: number;
    minLatency: number;
    maxLatency: number;
    p95Latency: number;
    errorRate: number;
  }> {
    console.log(`🔥 开始 ${config.displayName} 性能测试 (${testDuration}秒)...`);

    const testDurationMs = testDuration * 1000;
    const startTime = performance.now();
    const endTime = startTime + testDurationMs;

    let totalRequests = 0;
    let successRequests = 0;
    let errorRequests = 0;
    const latencies: number[] = [];
    const concurrency = 20;

    const sendConcurrentRequests = async () => {
      const batchSize = 50;
      let batch: Promise<{ latency: number; success: boolean }>[] = [];

      while (performance.now() < endTime) {
        const endpoint = this.testEndpoints[Math.floor(Math.random() * this.testEndpoints.length)];
        batch.push(this.sendRequest(endpoint, config.port));

        if (batch.length >= batchSize) {
          try {
            const results = await Promise.all(batch);
            results.forEach((result) => {
              totalRequests++;
              if (result.success) {
                successRequests++;
                latencies.push(result.latency);
              } else {
                errorRequests++;
              }
            });
            batch = [];

            if (totalRequests % 1000 === 0) {
              await new Promise((resolve) => setTimeout(resolve, 1));
            }
          } catch (error) {
            for (const requestPromise of batch) {
              try {
                const result = await requestPromise;
                totalRequests++;
                if (result.success) {
                  successRequests++;
                  latencies.push(result.latency);
                } else {
                  errorRequests++;
                }
              } catch {
                totalRequests++;
                errorRequests++;
              }
            }
            batch = [];
          }
        }

        const currentTime = performance.now();
        const progress = (currentTime - startTime) / testDurationMs;
        const delayMs = progress > 0.8 ? 2 : progress > 0.5 ? 1 : 0;

        if (delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }

      if (batch.length > 0) {
        try {
          const results = await Promise.all(batch);
          results.forEach((result) => {
            totalRequests++;
            if (result.success) {
              successRequests++;
              latencies.push(result.latency);
            } else {
              errorRequests++;
            }
          });
        } catch (error) {
          for (const requestPromise of batch) {
            try {
              const result = await requestPromise;
              totalRequests++;
              if (result.success) {
                successRequests++;
                latencies.push(result.latency);
              } else {
                errorRequests++;
              }
            } catch {
              totalRequests++;
              errorRequests++;
            }
          }
        }
      }
    };

    const testPromises = Array.from({ length: concurrency }, () => sendConcurrentRequests());

    try {
      await Promise.all(testPromises);
    } catch (error) {
      console.warn(`⚠️  ${config.displayName} 测试中出现部分错误: ${error}`);
    }

    if (latencies.length === 0) {
      throw new Error(`${config.displayName} 测试失败：没有成功的请求`);
    }

    latencies.sort((a, b) => a - b);
    const averageLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
    const minLatency = latencies[0];
    const maxLatency = latencies[latencies.length - 1];
    const p95Latency = latencies[Math.floor(latencies.length * 0.95)];
    const errorRate = totalRequests > 0 ? (errorRequests / totalRequests) * 100 : 0;

    console.log(
      `📊 ${
        config.displayName
      } 完成 ${totalRequests} 个请求 (成功: ${successRequests}, 错误: ${errorRequests}, 错误率: ${errorRate.toFixed(
        2
      )}%)`
    );

    return {
      totalRequests: successRequests,
      averageLatency,
      minLatency,
      maxLatency,
      p95Latency,
      errorRate,
    };
  }

  /**
   * 测试单个框架
   */
  private async testFramework(
    config: FrameworkConfig,
    testDuration: number
  ): Promise<PerformanceMetrics | null> {
    try {
      console.log(`🔄 测试 ${config.displayName} (端口: ${config.port})`);

      // 健康检查
      if (!(await this.healthCheck(config.port))) {
        throw new Error(`服务不可用，端口 ${config.port} 无响应`);
      }

      console.log(`✅ ${config.displayName} 服务可用，开始测试`);

      // 预热
      try {
        await this.sendRequest(this.testEndpoints[0], config.port);
        console.log(`🔥 ${config.displayName} 预热完成`);
      } catch (warmupError) {
        console.warn(`⚠️  ${config.displayName} 预热失败，继续测试`);
      }

      // 性能测试
      const testStart = performance.now();
      const testResults = await this.runPerformanceTest(config, testDuration);
      const actualTestDuration = performance.now() - testStart;

      const requestsPerSecond = testResults.totalRequests / (actualTestDuration / 1000);

      if (testResults.totalRequests < 10) {
        throw new Error(`测试请求数过少: ${testResults.totalRequests}`);
      }

      if (testResults.errorRate > 50) {
        throw new Error(`错误率过高: ${testResults.errorRate.toFixed(2)}%`);
      }

      return {
        framework: config.displayName,
        coldStartTime: 0, // 手动启动模式下为0
        totalRequests: testResults.totalRequests,
        requestsPerSecond,
        averageLatency: testResults.averageLatency,
        minLatency: testResults.minLatency,
        maxLatency: testResults.maxLatency,
        p95Latency: testResults.p95Latency,
        testDuration: actualTestDuration,
        errorRate: testResults.errorRate,
        memoryUsage: this.getMemoryUsage(),
      };
    } catch (error) {
      console.error(
        `❌ ${config.displayName} 测试失败:`,
        error instanceof Error ? error.message : error
      );
      return null;
    }
  }

  /**
   * 获取内存使用情况
   */
  private getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      heapUsed: Math.round((usage.heapUsed / 1024 / 1024) * 100) / 100,
      heapTotal: Math.round((usage.heapTotal / 1024 / 1024) * 100) / 100,
      external: Math.round((usage.external / 1024 / 1024) * 100) / 100,
      rss: Math.round((usage.rss / 1024 / 1024) * 100) / 100,
    };
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
   * 打印对比报告
   */
  private printComparisonReport(results: PerformanceMetrics[]): void {
    if (results.length === 0) {
      console.log("❌ 没有测试结果可供对比");
      return;
    }

    console.log(`\n${"=".repeat(80)}`);
    console.log("🏆 框架性能对比报告");
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
    console.log(`${"=".repeat(80)}\n`);
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
      const results: PerformanceMetrics[] = [];

      for (const config of this.frameworkConfigs) {
        console.log(`\n${"=".repeat(40)}`);
        console.log(`🔄 测试 ${config.displayName}`);
        console.log(`${"=".repeat(40)}`);

        const result = await this.testFramework(config, this.config.testDuration);
        if (result) {
          results.push(result);
          console.log(`\n📊 ${result.framework} 测试结果:`);
          console.log(`   ❄️  冷启动时间:     ${result.coldStartTime.toFixed(2)} ms`);
          console.log(`   📈  总请求数:       ${result.totalRequests} 个`);
          console.log(`   🚀  请求数/秒:      ${result.requestsPerSecond.toFixed(2)} RPS`);
          console.log(`   ⏱️   平均延迟:       ${result.averageLatency.toFixed(2)} ms`);
          console.log(
            `   📊  延迟范围:       ${result.minLatency.toFixed(2)} - ${result.maxLatency.toFixed(
              2
            )} ms`
          );
          console.log(`   🎯  P95延迟:        ${result.p95Latency.toFixed(2)} ms`);
          console.log(`   ❌  错误率:         ${result.errorRate.toFixed(2)}%`);
        }
      }

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

      console.log(`\n🎉 批量测试完成！所有结果已保存到: ${this.config.outputDir}`);

      return results;
    } catch (error) {
      console.error("❌ 批量测试执行失败:", error);
      throw error;
    }
  }
}

// 主执行函数
async function main() {
  // 解析命令行参数
  const args = process.argv.slice(2);
  let testDuration = 10;
  let outputDir = "test-results/batch-test";

  // 查找位置参数
  for (let i = 0; i < args.length; i++) {
    if (!args[i].startsWith("--") && !isNaN(Number(args[i]))) {
      testDuration = parseInt(args[i]);
      break;
    }
  }

  // 查找第二个位置参数（输出目录）
  for (let i = 0; i < args.length; i++) {
    if (!args[i].startsWith("--") && Number.isNaN(Number(args[i]))) {
      outputDir = args[i];
      break;
    }
  }

  const config: BatchTestConfig = {
    testDuration,
    outputDir,
    includeK6: args.includes("--k6"),
    saveDetailedResults: !args.includes("--no-details"),
    saveComparisonReport: !args.includes("--no-report"),
    manualStart: args.includes("--manual"),
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

export { BatchFrameworkTester, BatchTestConfig, PerformanceMetrics };
