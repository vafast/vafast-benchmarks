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

interface TestEndpoint {
  path: string;
  method: "GET" | "POST";
  body?: any;
  description: string;
}

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
}

interface LatencyRecord {
  latency: number;
  success: boolean;
}

class UniversalFrameworkTester {
  // 公共测试端点配置
  private readonly commonTestEndpoints: TestEndpoint[] = [
    { path: "/techempower/json", method: "GET", description: "JSON序列化测试" },
    // { path: "/techempower/plaintext", method: "GET", description: "纯文本响应测试" },
    // { path: "/techempower/db?queries=1", method: "GET", description: "数据库查询模拟" },
    // {
    //   path: "/schema/validate",
    //   method: "POST",
    //   description: "Schema验证测试",
    //   body: {
    //     user: {
    //       name: "Test User",
    //       phone: "13800138000",
    //       age: 25,
    //       email: "test@example.com",
    //       active: true,
    //       tags: ["test", "user"],
    //       preferences: {
    //         theme: "light",
    //         language: "zh-CN",
    //       },
    //     },
    //     metadata: {
    //       version: "1.0.0",
    //       timestamp: new Date().toISOString(),
    //     },
    //   },
    // },
  ];

  // 简化的框架配置
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
      name: "vafast-mini",
      displayName: "Vafast-mini",
      directory: "frameworks/vafast-mini",
      startCommand: ["bun", "run", "src/index.ts"],
      port: 3004,
    },
    {
      name: "vafast",
      displayName: "Vafast",
      directory: "frameworks/vafast",
      startCommand: ["bun", "run", "src/index.ts"],
      port: 3005,
    },
  ];

  private serverProcesses: Map<string, ChildProcess> = new Map();

  /**
   * 检查框架是否存在并可用
   */
  private checkFrameworkAvailable(config: FrameworkConfig): boolean {
    const srcPath = join(config.directory, "src", "index.ts");
    const packagePath = join(config.directory, "package.json");
    return existsSync(srcPath) && existsSync(packagePath);
  }

  /**
   * 启动框架服务器并测量冷启动时间
   */
  private async startFrameworkServer(config: FrameworkConfig): Promise<number> {
    console.log(`🔄 启动 ${config.displayName} 服务器...`);

    const coldStartBegin = performance.now();

    return new Promise((resolve, reject) => {
      const serverProcess = spawn(config.startCommand[0], config.startCommand.slice(1), {
        cwd: config.directory,
        stdio: "pipe",
        env: { ...process.env, PORT: config.port.toString() },
      });

      this.serverProcesses.set(config.name, serverProcess);

      const checkServerReady = () => {
        const testEndpoint = this.commonTestEndpoints[0];
        http
          .get(`http://localhost:${config.port}${testEndpoint.path}`, (res) => {
            if (res.statusCode === 200) {
              const coldStartTime = performance.now() - coldStartBegin;
              console.log(
                `✅ ${config.displayName} 启动成功，冷启动时间: ${coldStartTime.toFixed(2)}ms`
              );
              resolve(coldStartTime);
            }
          })
          .on("error", () => {
            setTimeout(checkServerReady, 100);
          });
      };

      setTimeout(checkServerReady, 1000);

      setTimeout(() => {
        reject(new Error(`${config.displayName} 启动超时`));
      }, 15000);

      serverProcess.on("error", (error) => {
        reject(new Error(`${config.displayName} 启动失败: ${error.message}`));
      });
    });
  }

  /**
   * 发送HTTP请求并测量延迟
   */
  private async sendRequest(endpoint: TestEndpoint, port: number): Promise<LatencyRecord> {
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
          ...(requestBody && { "Content-Length": Buffer.byteLength(requestBody) }),
        },
        timeout: 5000,
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
   * 执行性能测试
   */
  private async runPerformanceTest(
    config: FrameworkConfig,
    testDuration: number = 10
  ): Promise<{
    totalRequests: number;
    averageLatency: number;
    minLatency: number;
    maxLatency: number;
    p95Latency: number;
  }> {
    console.log(`🔥 开始 ${config.displayName} 性能测试 (${testDuration}秒)...`);

    const testDurationMs = testDuration * 1000;
    const startTime = performance.now();
    const endTime = startTime + testDurationMs;

    let totalRequests = 0;
    let successRequests = 0;
    const latencies: number[] = [];
    const concurrency = 10;

    const sendConcurrentRequests = async () => {
      while (performance.now() < endTime) {
        try {
          const endpoint =
            this.commonTestEndpoints[Math.floor(Math.random() * this.commonTestEndpoints.length)];
          const result = await this.sendRequest(endpoint, config.port);

          totalRequests++;
          if (result.success) {
            successRequests++;
            latencies.push(result.latency);
          }
        } catch (error) {
          totalRequests++;
        }
      }
    };

    const promises = Array.from({ length: concurrency }, () => sendConcurrentRequests());
    await Promise.all(promises);

    if (latencies.length === 0) {
      throw new Error(`${config.displayName} 测试失败：没有成功的请求`);
    }

    latencies.sort((a, b) => a - b);
    const averageLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
    const minLatency = latencies[0];
    const maxLatency = latencies[latencies.length - 1];
    const p95Latency = latencies[Math.floor(latencies.length * 0.95)];

    console.log(`📊 ${config.displayName} 完成 ${totalRequests} 个请求 (成功: ${successRequests})`);

    return {
      totalRequests: successRequests,
      averageLatency,
      minLatency,
      maxLatency,
      p95Latency,
    };
  }

  /**
   * 停止所有服务器
   */
  private async stopAllServers(): Promise<void> {
    console.log("🛑 停止所有服务器...");

    for (const [name, process] of this.serverProcesses) {
      if (process && !process.killed) {
        process.kill("SIGTERM");
      }
    }

    this.serverProcesses.clear();
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  /**
   * 测试单个框架
   */
  async testFramework(
    frameworkName: string,
    testDuration: number = 10
  ): Promise<PerformanceMetrics | null> {
    const config = this.frameworkConfigs.find((c) => c.name === frameworkName);
    if (!config) {
      console.error(`❌ 未找到框架配置: ${frameworkName}`);
      return null;
    }

    if (!this.checkFrameworkAvailable(config)) {
      console.error(`❌ ${config.displayName} 不可用，跳过测试`);
      return null;
    }

    try {
      const coldStartTime = await this.startFrameworkServer(config);
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const testStart = performance.now();
      const testResults = await this.runPerformanceTest(config, testDuration);
      const actualTestDuration = performance.now() - testStart;

      const requestsPerSecond = testResults.totalRequests / (actualTestDuration / 1000);

      return {
        framework: config.displayName,
        coldStartTime,
        totalRequests: testResults.totalRequests,
        requestsPerSecond,
        averageLatency: testResults.averageLatency,
        minLatency: testResults.minLatency,
        maxLatency: testResults.maxLatency,
        p95Latency: testResults.p95Latency,
        testDuration: actualTestDuration,
      };
    } catch (error) {
      console.error(`❌ ${config.displayName} 测试失败:`, error);
      return null;
    }
  }

  /**
   * 测试所有可用框架
   */
  async testAllFrameworks(testDuration: number = 10): Promise<PerformanceMetrics[]> {
    console.log("🚀 开始通用框架性能测试");
    console.log("=".repeat(60));

    const results: PerformanceMetrics[] = [];
    const availableFrameworks = this.frameworkConfigs.filter((config) =>
      this.checkFrameworkAvailable(config)
    );

    console.log(`📋 发现 ${availableFrameworks.length} 个可用框架:`);
    availableFrameworks.forEach((config) => {
      console.log(`   • ${config.displayName} (端口: ${config.port})`);
    });

    if (availableFrameworks.length === 0) {
      console.log("❌ 没有发现可用的框架");
      return results;
    }

    for (const config of availableFrameworks) {
      console.log(`\n${"=".repeat(40)}`);
      console.log(`🔄 测试 ${config.displayName}`);
      console.log(`${"=".repeat(40)}`);

      const result = await this.testFramework(config.name, testDuration);

      if (result) {
        results.push(result);
        this.printFrameworkResult(result);
      }

      const serverProcess = this.serverProcesses.get(config.name);
      if (serverProcess) {
        serverProcess.kill("SIGTERM");
        this.serverProcesses.delete(config.name);
      }

      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    return results;
  }

  /**
   * 打印单个框架测试结果
   */
  private printFrameworkResult(result: PerformanceMetrics): void {
    console.log(`\n📊 ${result.framework} 测试结果:`);
    console.log(`   ❄️  冷启动时间:     ${result.coldStartTime.toFixed(2)} ms`);
    console.log(`   📈  总请求数:       ${result.totalRequests} 个`);
    console.log(`   🚀  请求数/秒:      ${result.requestsPerSecond.toFixed(2)} RPS`);
    console.log(`   ⏱️   平均延迟:       ${result.averageLatency.toFixed(2)} ms`);
    console.log(
      `   📊  延迟范围:       ${result.minLatency.toFixed(2)} - ${result.maxLatency.toFixed(2)} ms`
    );
    console.log(`   🎯  P95延迟:        ${result.p95Latency.toFixed(2)} ms`);
  }

  /**
   * 打印对比报告
   */
  printComparisonReport(results: PerformanceMetrics[]): void {
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
   * 运行完整测试
   */
  async runFullTest(testDuration: number = 10): Promise<PerformanceMetrics[]> {
    try {
      const results = await this.testAllFrameworks(testDuration);
      this.printComparisonReport(results);
      return results;
    } catch (error) {
      console.error("❌ 测试执行失败:", error);
      throw error;
    } finally {
      await this.stopAllServers();
    }
  }
}

// 主执行函数
async function main() {
  const tester = new UniversalFrameworkTester();

  const testDuration = process.argv[2] ? parseInt(process.argv[2]) : 10;

  console.log(`🎯 开始 ${testDuration} 秒通用框架性能测试\n`);

  try {
    await tester.runFullTest(testDuration);
  } catch (error) {
    console.error("测试执行失败:", error);
    process.exit(1);
  }
}

// 如果直接运行此文件则执行测试
if (require.main === module) {
  main();
}

export { UniversalFrameworkTester, PerformanceMetrics, FrameworkConfig };
