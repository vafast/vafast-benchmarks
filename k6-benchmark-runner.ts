import { spawn, ChildProcess } from "child_process";
import { performance } from "perf_hooks";
import * as http from "http";
import { existsSync } from "fs";
import { join } from "path";
import ServerManager from "./start-servers";

interface K6TestResult {
  framework: string;
  testDuration: number;
  totalRequests: number;
  requestsPerSecond: number;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  errorRate: number;
  success: boolean;
  error?: string;
}

class K6BenchmarkRunner {
  private serverManager: ServerManager;

  constructor() {
    this.serverManager = new ServerManager();
  }

  /**
   * 运行 k6 测试
   */
  private async runK6Test(framework: string, port: number): Promise<K6TestResult> {
    return new Promise((resolve) => {
      console.log(`🧪 开始 k6 测试 ${framework}...`);

      const startTime = performance.now();

      // 设置环境变量
      const env = {
        ...process.env,
        BASE_URL: `http://localhost:${port}`,
        FRAMEWORK: framework,
      };

      // 运行 k6 测试
      const k6Process = spawn("k6", [
        "run", 
        "--out", `json=test-results/k6-${framework}-results.json`,
        "--out", `csv=test-results/k6-${framework}-results.csv`,
        "k6-test-config.js"
      ], {
        env,
        stdio: "pipe",
      });

      let output = "";
      let errorOutput = "";

      k6Process.stdout?.on("data", (data) => {
        output += data.toString();
        console.log(`[${framework}] ${data.toString().trim()}`);
      });

      k6Process.stderr?.on("data", (data) => {
        errorOutput += data.toString();
        console.error(`[${framework}] ${data.toString().trim()}`);
      });

      k6Process.on("close", (code) => {
        const testDuration = performance.now() - startTime;

        if (code === 0) {
          // 解析 k6 输出结果
          const result = this.parseK6Output(output, framework, testDuration);
          resolve(result);
        } else {
          resolve({
            framework,
            testDuration,
            totalRequests: 0,
            requestsPerSecond: 0,
            averageLatency: 0,
            p95Latency: 0,
            p99Latency: 0,
            errorRate: 1,
            success: false,
            error: `k6 测试失败，退出码: ${code}\n${errorOutput}`,
          });
        }
      });

      k6Process.on("error", (error) => {
        resolve({
          framework,
          testDuration: performance.now() - startTime,
          totalRequests: 0,
          requestsPerSecond: 0,
          averageLatency: 0,
          p95Latency: 0,
          p99Latency: 0,
          errorRate: 1,
          success: false,
          error: `k6 执行错误: ${error.message}`,
        });
      });
    });
  }

  /**
   * 解析 k6 输出结果
   */
  private parseK6Output(output: string, framework: string, testDuration: number): K6TestResult {
    try {
      // 尝试从输出中提取关键指标
      const lines = output.split("\n");
      let totalRequests = 0;
      let requestsPerSecond = 0;
      let averageLatency = 0;
      let p95Latency = 0;
      let p99Latency = 0;
      let errorRate = 0;

      for (const line of lines) {
        // 提取总请求数 - 匹配 "http_reqs......................: 169570 16955.879216/s"
        if (line.includes("http_reqs") && line.includes(":")) {
          const match = line.match(/http_reqs[^:]*:\s*(\d+)\s+([\d.]+)\/s/);
          if (match) {
            totalRequests = parseInt(match[1]);
            requestsPerSecond = parseFloat(match[2]);
          }
        }
        // 提取平均响应时间 - 匹配 "avg=202.35µs"
        if (line.includes("http_req_duration") && line.includes("avg=")) {
          const match = line.match(/avg=([\d.]+)µs/);
          if (match) averageLatency = parseFloat(match[1]);
        }
        // 提取P95响应时间 - 匹配 "p(95)=520µs"
        if (line.includes("p(95)=")) {
          const match = line.match(/p\(95\)=([\d.]+)µs/);
          if (match) p95Latency = parseFloat(match[1]);
        }
        // 提取P99响应时间 - 匹配 "p(99)=999.3µs"
        if (line.includes("p(99)=")) {
          const match = line.match(/p\(99\)=([\d.]+)µs/);
          if (match) p99Latency = parseFloat(match[1]);
        }
        // 提取错误率 - 匹配 "rate=0.00%"
        if (line.includes("http_req_failed") && line.includes("rate=")) {
          const match = line.match(/rate=([\d.]+)%/);
          if (match) errorRate = parseFloat(match[1]) / 100;
        }
      }

      // 如果无法从输出中提取到数据，尝试从自定义摘要中提取
      if (totalRequests === 0) {
        const summaryMatch = output.match(/总请求数:\s*(\d+)/);
        if (summaryMatch) totalRequests = parseInt(summaryMatch[1]);
      }
      
      if (requestsPerSecond === 0) {
        const rateMatch = output.match(/请求速率:\s*(\d+\.?\d*)/);
        if (rateMatch) requestsPerSecond = parseFloat(rateMatch[1]);
      }

      return {
        framework,
        testDuration,
        totalRequests,
        requestsPerSecond,
        averageLatency,
        p95Latency,
        p99Latency,
        errorRate,
        success: true,
      };
    } catch (error) {
      return {
        framework,
        testDuration,
        totalRequests: 0,
        requestsPerSecond: 0,
        averageLatency: 0,
        p95Latency: 0,
        p99Latency: 0,
        errorRate: 1,
        success: false,
        error: `解析 k6 输出失败: ${error}`,
      };
    }
  }

  /**
   * 运行完整的基准测试
   */
  async runBenchmark(): Promise<K6TestResult[]> {
    const results: K6TestResult[] = [];

    try {
      console.log("🚀 开始 K6 框架性能基准测试...\n");

      for (const config of this.serverManager.getFrameworkConfigs()) {
        console.log(`\n📊 测试框架: ${config.displayName}`);
        console.log("=".repeat(50));

        try {
          // 启动服务器
          const serverStarted = await this.serverManager.startFrameworkServer(config);
          if (!serverStarted) {
            console.log(`❌ ${config.displayName} 服务器启动失败，跳过测试`);
            results.push({
              framework: config.name,
              testDuration: 0,
              totalRequests: 0,
              requestsPerSecond: 0,
              averageLatency: 0,
              p95Latency: 0,
              p99Latency: 0,
              errorRate: 1,
              success: false,
              error: "服务器启动失败",
            });
            continue;
          }

          // 等待服务器就绪
          const serverReady = await this.serverManager.waitForServerReady(config.port);
          if (!serverReady) {
            console.log(`❌ ${config.displayName} 服务器未就绪，跳过测试`);
            results.push({
              framework: config.name,
              testDuration: 0,
              totalRequests: 0,
              requestsPerSecond: 0,
              averageLatency: 0,
              p95Latency: 0,
              p99Latency: 0,
              errorRate: 1,
              success: false,
              error: "服务器未就绪",
            });
            continue;
          }

          // 运行 k6 测试
          const result = await this.runK6Test(config.name, config.port);
          results.push(result);

          if (result.success) {
            console.log(`✅ ${config.displayName} 测试完成`);
            console.log(`   请求数: ${result.totalRequests}`);
            console.log(`   请求速率: ${result.requestsPerSecond.toFixed(2)} req/s`);
            console.log(`   平均延迟: ${result.averageLatency.toFixed(2)}ms`);
            console.log(`   P95延迟: ${result.p95Latency.toFixed(2)}ms`);
            console.log(`   P99延迟: ${result.p99Latency.toFixed(2)}ms`);
            console.log(`   错误率: ${(result.errorRate * 100).toFixed(2)}%`);
          } else {
            console.log(`❌ ${config.displayName} 测试失败: ${result.error}`);
          }
        } catch (error) {
          console.error(`❌ 测试 ${config.displayName} 时发生错误:`, error);
          results.push({
            framework: config.name,
            testDuration: 0,
            totalRequests: 0,
            requestsPerSecond: 0,
            averageLatency: 0,
            p95Latency: 0,
            p99Latency: 0,
            errorRate: 1,
            success: false,
            error: `测试执行错误: ${error}`,
          });
        }
      }
    } catch (error) {
      console.error("❌ 基准测试执行失败:", error);
    } finally {
      await this.serverManager.stopAllServers();
    }

    return results;
  }

  /**
   * 生成测试报告
   */
  generateReport(results: K6TestResult[]): void {
    console.log("\n📊 K6 基准测试完整报告");
    console.log("=".repeat(80));

    // 按请求速率排序
    const sortedResults = results
      .filter((r) => r.success)
      .sort((a, b) => b.requestsPerSecond - a.requestsPerSecond);

    if (sortedResults.length === 0) {
      console.log("❌ 没有成功的测试结果");
      return;
    }

    console.log("\n🏆 性能排名 (按请求速率):");
    console.log(
      "排名 | 框架 | 请求速率(req/s) | 平均延迟(ms) | P95延迟(ms) | P99延迟(ms) | 错误率(%)"
    );
    console.log("-".repeat(90));

    sortedResults.forEach((result, index) => {
      const rank = index + 1;
      const emoji = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "  ";

      console.log(
        `${emoji} ${rank.toString().padStart(2)} | ${result.framework.padEnd(12)} | ` +
          `${result.requestsPerSecond.toFixed(2).padStart(12)} | ` +
          `${result.averageLatency.toFixed(2).padStart(12)} | ` +
          `${result.p95Latency.toFixed(2).padStart(12)} | ` +
          `${result.p99Latency.toFixed(2).padStart(12)} | ` +
          `${(result.errorRate * 100).toFixed(2).padStart(8)}`
      );
    });

    // 失败测试
    const failedTests = results.filter((r) => !r.success);
    if (failedTests.length > 0) {
      console.log("\n❌ 失败的测试:");
      failedTests.forEach((result) => {
        console.log(`  ${result.framework}: ${result.error}`);
      });
    }

    console.log("\n" + "=".repeat(80));
  }
}

// 主函数
async function main() {
  const runner = new K6BenchmarkRunner();

  try {
    const results = await runner.runBenchmark();
    runner.generateReport(results);

    // 保存结果到文件
    const fs = await import("fs");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `test-results/k6-benchmark-${timestamp}.json`;

    fs.writeFileSync(filename, JSON.stringify(results, null, 2));
    console.log(`\n💾 测试结果已保存到: ${filename}`);
  } catch (error) {
    console.error("❌ 主程序执行失败:", error);
    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  main();
}

export { K6BenchmarkRunner, K6TestResult };
