import { spawn, ChildProcess } from "child_process";
import { performance } from "perf_hooks";
import * as http from "http";
import { existsSync } from "fs";
import { join } from "path";

interface FrameworkConfig {
  name: string;
  displayName: string;
  directory: string;
  startCommand: string[];
  port: number;
}

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
  private readonly frameworkConfigs: FrameworkConfig[] = [
    {
      name: "elysia",
      displayName: "Elysia",
      directory: "frameworks/elysia",
      startCommand: ["bun", "run", "src/index.ts"],
      port: 3000,
    },
    {
      name: "hono",
      displayName: "Hono",
      directory: "frameworks/hono",
      startCommand: ["bun", "run", "src/index.ts"],
      port: 3001,
    },
    {
      name: "express",
      displayName: "Express",
      directory: "frameworks/express",
      startCommand: ["bun", "run", "src/index.ts"],
      port: 3002,
    },
    {
      name: "koa",
      displayName: "Koa",
      directory: "frameworks/koa",
      startCommand: ["bun", "run", "src/index.ts"],
      port: 3003,
    },
    {
      name: "vafast",
      displayName: "Vafast",
      directory: "frameworks/vafast",
      startCommand: ["bun", "run", "src/index.ts"],
      port: 3004,
    },
    {
      name: "vafast-mini",
      displayName: "Vafast-Mini",
      directory: "frameworks/vafast-mini",
      startCommand: ["bun", "run", "src/index.ts"],
      port: 3005,
    },
  ];

  private servers: Map<string, ChildProcess> = new Map();

  /**
   * 启动框架服务器
   */
  private async startFrameworkServer(config: FrameworkConfig): Promise<boolean> {
    return new Promise((resolve) => {
      console.log(`🚀 启动 ${config.displayName} 服务器...`);

      const server = spawn(config.startCommand[0], config.startCommand.slice(1), {
        cwd: config.directory,
        stdio: "pipe",
      });

      let output = "";
      let started = false;

      server.stdout?.on("data", (data) => {
        output += data.toString();
        // 检查多种可能的启动成功标识
        if (!started && (
          output.includes("Server running") || 
          output.includes("listening") ||
          output.includes("running at") ||
          output.includes("🦊 Elysia is running") ||
          output.includes("Server started") ||
          output.includes("Ready")
        )) {
          started = true;
          console.log(`✅ ${config.displayName} 服务器已启动 (端口: ${config.port})`);
          resolve(true);
        }
      });

      server.stderr?.on("data", (data) => {
        output += data.toString();
      });

      server.on("error", (error) => {
        console.error(`❌ ${config.displayName} 启动失败:`, error.message);
        resolve(false);
      });

      // 超时处理 - 增加超时时间到 20 秒
      setTimeout(() => {
        if (!started) {
          console.error(`⏰ ${config.displayName} 启动超时 (20秒)`);
          server.kill();
          resolve(false);
        }
      }, 20000);

      this.servers.set(config.name, server);
    });
  }

  /**
   * 等待服务器就绪
   */
  private async waitForServerReady(port: number, timeout: number = 30000): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const response = await this.makeRequest(`http://localhost:${port}/techempower/json`);
        if (response.status === 200) {
          return true;
        }
      } catch (error) {
        // 服务器还未就绪，继续等待
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return false;
  }

  /**
   * 发送 HTTP 请求
   */
  private async makeRequest(url: string): Promise<{ status: number; body: string }> {
    return new Promise((resolve, reject) => {
      const req = http.get(url, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolve({ status: res.statusCode || 0, body }));
      });

      req.on("error", reject);
      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error("Request timeout"));
      });
    });
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
      const k6Process = spawn("k6", ["run", "k6-test-config.js"], {
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
        if (line.includes("http_reqs")) {
          const match = line.match(/(\d+)/);
          if (match) totalRequests = parseInt(match[1]);
        }
        if (line.includes("http_req_rate")) {
          const match = line.match(/(\d+\.?\d*)/);
          if (match) requestsPerSecond = parseFloat(match[1]);
        }
        if (line.includes("http_req_duration")) {
          const match = line.match(/avg=(\d+\.?\d*)/);
          if (match) averageLatency = parseFloat(match[1]);
        }
        if (line.includes("p(95)")) {
          const match = line.match(/p\(95\)=(\d+\.?\d*)/);
          if (match) p95Latency = parseFloat(match[1]);
        }
        if (line.includes("p(99)")) {
          const match = line.match(/p\(99\)=(\d+\.?\d*)/);
          if (match) p99Latency = parseFloat(match[1]);
        }
        if (line.includes("http_req_failed")) {
          const match = line.match(/(\d+\.?\d*)/);
          if (match) errorRate = parseFloat(match[1]);
        }
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
   * 停止所有服务器
   */
  private async stopAllServers(): Promise<void> {
    console.log("🛑 停止所有服务器...");

    for (const [name, server] of this.servers) {
      try {
        server.kill("SIGTERM");
        console.log(`✅ ${name} 服务器已停止`);
      } catch (error) {
        console.error(`❌ 停止 ${name} 服务器失败:`, error);
      }
    }

    this.servers.clear();
  }

  /**
   * 运行完整的基准测试
   */
  async runBenchmark(): Promise<K6TestResult[]> {
    const results: K6TestResult[] = [];

    try {
      console.log("🚀 开始 K6 框架性能基准测试...\n");

      for (const config of this.frameworkConfigs) {
        console.log(`\n📊 测试框架: ${config.displayName}`);
        console.log("=".repeat(50));

        try {
          // 启动服务器
          const serverStarted = await this.startFrameworkServer(config);
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
          const serverReady = await this.waitForServerReady(config.port);
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
      await this.stopAllServers();
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
