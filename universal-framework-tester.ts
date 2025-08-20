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
  errorRate: number;
  memoryUsage?: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
}

interface LatencyRecord {
  latency: number;
  success: boolean;
}

class UniversalFrameworkTester {
  // 公共测试端点配置
  private readonly commonTestEndpoints: TestEndpoint[] = [
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
  private gcIntervalId?: NodeJS.Timeout;

  constructor() {
    // 启用垃圾回收监控
    this.enableMemoryManagement();
  }

  /**
   * 启用内存管理和垃圾回收优化
   */
  private enableMemoryManagement(): void {
    // 定期强制垃圾回收以减少内存占用
    this.gcIntervalId = setInterval(() => {
      if (global.gc) {
        global.gc();
        const memUsage = process.memoryUsage();
        if (memUsage.heapUsed > 100 * 1024 * 1024) {
          // 超过100MB时发出警告
          console.warn(`⚠️  高内存使用: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
        }
      }
    }, 5000);

    // 进程退出时清理资源
    process.on("exit", () => this.cleanup());
    process.on("SIGINT", () => this.cleanup());
    process.on("SIGTERM", () => this.cleanup());
  }

  /**
   * 获取当前内存使用情况
   */
  private getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      heapUsed: Math.round((usage.heapUsed / 1024 / 1024) * 100) / 100, // MB
      heapTotal: Math.round((usage.heapTotal / 1024 / 1024) * 100) / 100,
      external: Math.round((usage.external / 1024 / 1024) * 100) / 100,
      rss: Math.round((usage.rss / 1024 / 1024) * 100) / 100,
    };
  }

  /**
   * 清理资源
   */
  private async cleanup(): Promise<void> {
    if (this.gcIntervalId) {
      clearInterval(this.gcIntervalId);
    }
    await this.stopAllServers();
  }

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
    let checkAttempts = 0;
    const maxAttempts = 250; // 25秒总超时

    return new Promise((resolve, reject) => {
      const serverProcess = spawn(config.startCommand[0], config.startCommand.slice(1), {
        cwd: config.directory,
        stdio: "pipe",
        env: { ...process.env, PORT: config.port.toString() },
      });

      this.serverProcesses.set(config.name, serverProcess);

      const checkServerReady = async () => {
        if (checkAttempts >= maxAttempts) {
          serverProcess.kill("SIGTERM");
          reject(new Error(`${config.displayName} 启动超时 (${maxAttempts / 10}秒)`));
          return;
        }

        checkAttempts++;

        try {
          const testEndpoint = this.commonTestEndpoints[0];
          const result = await this.sendHealthCheck(testEndpoint, config.port);

          if (result.success) {
            const coldStartTime = performance.now() - coldStartBegin;
            console.log(
              `✅ ${config.displayName} 启动成功，冷启动时间: ${coldStartTime.toFixed(
                2
              )}ms (检查次数: ${checkAttempts})`
            );
            resolve(coldStartTime);
            return;
          }
        } catch (error) {
          // 忽略连接错误，继续重试
        }

        setTimeout(checkServerReady, 100);
      };

      // 给服务器更多启动时间
      setTimeout(checkServerReady, 1000);

      serverProcess.on("error", (error) => {
        reject(new Error(`${config.displayName} 启动失败: ${error.message}`));
      });

      // 监听进程退出
      serverProcess.on("exit", (code) => {
        if (code !== null && code !== 0) {
          reject(new Error(`${config.displayName} 进程异常退出，退出码: ${code}`));
        }
      });
    });
  }

  /**
   * 发送健康检查请求
   */
  private async sendHealthCheck(endpoint: TestEndpoint, port: number): Promise<LatencyRecord> {
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
          Connection: "close",
          ...(requestBody && { "Content-Length": Buffer.byteLength(requestBody) }),
        },
        timeout: 2000, // 健康检查超时时间更短
      };

      const req = http.request(options, (res) => {
        res.on("data", () => {}); // 消费数据但不存储
        res.on("end", () => {
          const latency = performance.now() - startTime;
          resolve({ latency, success: res.statusCode! >= 200 && res.statusCode! < 500 });
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
          Connection: "keep-alive",
          ...(requestBody && { "Content-Length": Buffer.byteLength(requestBody) }),
        },
        timeout: 5000,
        agent: false, // 禁用连接池以获得更准确的延迟测量
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
    const concurrency = 20; // 提高并发数

    // 使用批量处理优化内存使用
    const processBatch = async (batchResults: LatencyRecord[]) => {
      batchResults.forEach((result) => {
        totalRequests++;
        if (result.success) {
          successRequests++;
          latencies.push(result.latency);
        } else {
          errorRequests++;
        }
      });
    };

    const sendConcurrentRequests = async () => {
      const batchSize = 50;
      let batch: Promise<LatencyRecord>[] = [];

      while (performance.now() < endTime) {
        // 随机选择测试端点
        const endpoint =
          this.commonTestEndpoints[Math.floor(Math.random() * this.commonTestEndpoints.length)];

        batch.push(this.sendRequest(endpoint, config.port));

        // 当批量达到指定大小时处理
        if (batch.length >= batchSize) {
          try {
            const results = await Promise.all(batch);
            await processBatch(results);
            batch = [];

            // 给系统一些喏息时间
            if (totalRequests % 1000 === 0) {
              await new Promise((resolve) => setTimeout(resolve, 1));
            }
          } catch (error) {
            // 批量处理失败，逐个处理
            for (const requestPromise of batch) {
              try {
                const result = await requestPromise;
                await processBatch([result]);
              } catch {
                totalRequests++;
                errorRequests++;
              }
            }
            batch = [];
          }
        }

        // 动态调整请求间隔以避免过载
        const currentTime = performance.now();
        const progress = (currentTime - startTime) / testDurationMs;
        const delayMs = progress > 0.8 ? 2 : progress > 0.5 ? 1 : 0;

        if (delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }

      // 处理剩余的请求
      if (batch.length > 0) {
        try {
          const results = await Promise.all(batch);
          await processBatch(results);
        } catch (error) {
          for (const requestPromise of batch) {
            try {
              const result = await requestPromise;
              await processBatch([result]);
            } catch {
              totalRequests++;
              errorRequests++;
            }
          }
        }
      }
    };

    // 启动并发测试
    const testPromises = Array.from({ length: concurrency }, () => sendConcurrentRequests());

    try {
      await Promise.all(testPromises);
    } catch (error) {
      console.warn(`⚠️  ${config.displayName} 测试中出现部分错误: ${error}`);
    }

    if (latencies.length === 0) {
      throw new Error(`${config.displayName} 测试失败：没有成功的请求`);
    }

    // 计算指标
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
   * 停止所有服务器（增强版本）
   */
  public async stopAllServers(): Promise<void> {
    console.log("🛑 停止所有服务器...");

    const stopPromises = Array.from(this.serverProcesses.entries()).map(async ([name, process]) => {
      if (!process || process.killed) return;

      try {
        // 优雅停止
        process.kill("SIGTERM");

        // 等待进程正常退出
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            console.warn(`⚠️  ${name} 优雅停止超时，强制终止`);
            if (!process.killed) {
              try {
                process.kill("SIGKILL");
                console.log(`🔨 ${name} 已被强制终止`);
              } catch (killError) {
                console.warn(`⚠️  强制终止 ${name} 失败:`, killError);
              }
            }
            resolve();
          }, 5000); // 增加超时时间到5秒

          process.on("exit", () => {
            clearTimeout(timeout);
            console.log(`✅ ${name} 已正常退出`);
            resolve();
          });

          process.on("error", () => {
            clearTimeout(timeout);
            console.warn(`⚠️  ${name} 进程错误`);
            resolve();
          });
        });
      } catch (error) {
        console.warn(`⚠️  停止 ${name} 时出错:`, error);
        // 强制终止
        if (!process.killed) {
          try {
            process.kill("SIGKILL");
            console.log(`🔨 ${name} 已被强制终止`);
          } catch (killError) {
            console.warn(`⚠️  强制终止 ${name} 失败:`, killError);
          }
        }
      }
    });

    await Promise.allSettled(stopPromises);
    this.serverProcesses.clear();

    // 额外等待，确保端口释放
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 强制清理可能残留的进程
    await this.forceCleanupProcesses();

    console.log("✅ 所有服务器已停止");
  }

  /**
   * 强制清理可能残留的进程
   */
  private async forceCleanupProcesses(): Promise<void> {
    try {
      // 在 macOS 上使用 ps 和 kill 命令强制清理
      const { exec } = require("child_process");
      const util = require("util");
      const execAsync = util.promisify(exec);

      // 查找可能残留的 bun 进程
      const { stdout: bunProcesses } = await execAsync(
        "ps aux | grep 'bun.*src/index.ts' | grep -v grep | awk '{print $2}'"
      );
      if (bunProcesses.trim()) {
        console.log("🔍 发现残留的 bun 进程，正在清理...");
        const pids = bunProcesses.trim().split("\n");
        for (const pid of pids) {
          if (pid) {
            try {
              await execAsync(`kill -9 ${pid}`);
              console.log(`✅ 已终止进程 ${pid}`);
            } catch (error) {
              console.warn(`⚠️  终止进程 ${pid} 失败:`, error.message);
            }
          }
        }
      }

      // 查找可能残留的 node 进程
      const { stdout: nodeProcesses } = await execAsync(
        "ps aux | grep 'node.*universal-framework-tester' | grep -v grep | awk '{print $2}'"
      );
      if (nodeProcesses.trim()) {
        console.log("🔍 发现残留的 node 进程，正在清理...");
        const pids = nodeProcesses.trim().split("\n");
        for (const pid of pids) {
          if (pid) {
            try {
              await execAsync(`kill -9 ${pid}`);
              console.log(`✅ 已终止进程 ${pid}`);
            } catch (error) {
              console.warn(`⚠️  终止进程 ${pid} 失败:`, error.message);
            }
          }
        }
      }
    } catch (error) {
      console.warn("⚠️  强制清理进程时出错:", error.message);
    }
  }

  /**
   * 清理指定框架的资源
   */
  private async cleanupFramework(frameworkName: string): Promise<void> {
    const serverProcess = this.serverProcesses.get(frameworkName);
    if (serverProcess && !serverProcess.killed) {
      return new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          try {
            serverProcess.kill("SIGKILL");
          } catch (error) {
            console.warn(`无法强制终止 ${frameworkName}: ${error}`);
          }
          resolve();
        }, 2000);

        serverProcess.on("exit", () => {
          clearTimeout(timeout);
          resolve();
        });

        try {
          serverProcess.kill("SIGTERM");
        } catch (error) {
          clearTimeout(timeout);
          console.warn(`终止 ${frameworkName} 时出错: ${error}`);
          resolve();
        }
      });
    }

    this.serverProcesses.delete(frameworkName);
    // 给系统一些清理时间
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  /**
   * 预热测试
   */
  private async warmupTest(config: FrameworkConfig): Promise<void> {
    console.log(`🔥 正在对 ${config.displayName} 进行预热...`);

    const warmupRequests = 10;
    const warmupPromises: Promise<LatencyRecord>[] = [];

    for (let i = 0; i < warmupRequests; i++) {
      const endpoint = this.commonTestEndpoints[i % this.commonTestEndpoints.length];
      warmupPromises.push(this.sendRequest(endpoint, config.port));
    }

    try {
      await Promise.all(warmupPromises);
      console.log(`✅ ${config.displayName} 预热完成`);
    } catch (error) {
      console.warn(`⚠️  ${config.displayName} 预热时出现部分错误: ${error}`);
    }
  }

  /**
   * 测试单个框架
   */
  async testFramework(
    frameworkName: string,
    testDuration: number = 10,
    maxRetries: number = 2,
    manualStart: boolean = false
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

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 ${config.displayName} 测试尝试 ${attempt}/${maxRetries}`);

        let coldStartTime = 0;

        if (!manualStart) {
          // 自动启动模式：清理之前可能的残留进程
          const existingProcess = this.serverProcesses.get(config.name);
          if (existingProcess && !existingProcess.killed) {
            existingProcess.kill("SIGKILL");
            this.serverProcesses.delete(config.name);
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }

          coldStartTime = await this.startFrameworkServer(config);

          // 等待服务器完全就绪
          await new Promise((resolve) => setTimeout(resolve, 2000));
        } else {
          // 手动启动模式：假设服务已经运行，只进行健康检查
          console.log(`⚠️  手动启动模式：跳过启动 ${config.displayName} 服务器`);
          
          // 等待服务器完全就绪
          await new Promise((resolve) => setTimeout(resolve, 2000));
          
          // 验证服务是否可用
          try {
            const testEndpoint = this.commonTestEndpoints[0];
            const result = await this.sendHealthCheck(testEndpoint, config.port);
            if (!result.success) {
              throw new Error(`服务不可用，状态检查失败`);
            }
            console.log(`✅ ${config.displayName} 服务可用，开始测试`);
            
            // 手动启动模式下，冷启动时间设为0（因为服务已经运行）
            coldStartTime = 0;
          } catch (error) {
            throw new Error(`服务不可用: ${error instanceof Error ? error.message : '未知错误'}`);
          }
        }

        // 执行预热请求
        try {
          const warmupEndpoint = this.commonTestEndpoints[0];
          await this.sendRequest(warmupEndpoint, config.port);
          console.log(`🔥 ${config.displayName} 预热完成`);
        } catch (warmupError) {
          console.warn(`⚠️  ${config.displayName} 预热失败，继续测试`);
        }

        const testStart = performance.now();
        const testResults = await this.runPerformanceTest(config, testDuration);
        const actualTestDuration = performance.now() - testStart;

        const requestsPerSecond = testResults.totalRequests / (actualTestDuration / 1000);

        // 验证测试结果合理性
        if (testResults.totalRequests < 10) {
          throw new Error(`测试请求数过少: ${testResults.totalRequests}`);
        }

        if (testResults.errorRate > 50) {
          throw new Error(`错误率过高: ${testResults.errorRate.toFixed(2)}%`);
        }

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
          errorRate: testResults.errorRate,
          memoryUsage: this.getMemoryUsage(),
        };
      } catch (error) {
        lastError = error as Error;
        console.error(`❌ ${config.displayName} 测试尝试 ${attempt}/${maxRetries} 失败:`, error);

        if (!manualStart) {
          // 自动启动模式：清理失败的进程
          const process = this.serverProcesses.get(config.name);
          if (process && !process.killed) {
            try {
              process.kill("SIGKILL");
            } catch (killError) {
              console.warn(`⚠️  清理进程失败:`, killError);
            }
          }
          this.serverProcesses.delete(config.name);
        }

        if (attempt < maxRetries) {
          const backoffTime = attempt * 2000; // 指数退避
          console.log(`⏳ 等待 ${backoffTime}ms 后重试...`);
          await new Promise((resolve) => setTimeout(resolve, backoffTime));
        }
      }
    }

    console.error(`❌ ${config.displayName} 所有尝试均失败，最后错误:`, lastError?.message);
    return null;
  }

  /**
   * 测试所有可用框架
   */
  async testAllFrameworks(testDuration: number = 10, manualStart: boolean = false): Promise<PerformanceMetrics[]> {
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

      const result = await this.testFramework(config.name, testDuration, manualStart);

      if (result) {
        results.push(result);
        this.printFrameworkResult(result);
      }

      // 增强的框架清理（仅在自动启动模式下）
      if (!manualStart) {
        console.log(`🧹 清理 ${config.displayName} 资源...`);
        await this.cleanupFramework(config.name);
        console.log(`✅ ${config.displayName} 资源清理完成`);

        // 等待更长时间确保端口完全释放
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } else {
        console.log(`⚠️  手动启动模式：跳过 ${config.displayName} 资源清理`);
      }
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
    console.log(`   ❌  错误率:         ${result.errorRate.toFixed(2)}%`);
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