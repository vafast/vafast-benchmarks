import { spawn, ChildProcess } from "child_process";
import { performance } from "perf_hooks";
import * as http from "http";

interface PerformanceResults {
  coldStartTime: number;
  totalRequests: number;
  requestsPerSecond: number;
  averageLatency: number;
  testDuration: number;
}

class ElysiaPerformanceDemo {
  private serverProcess: ChildProcess | null = null;
  private readonly serverUrl = "http://localhost:3000";
  private readonly testEndpoints = [
    "/techempower/json",
    "/techempower/plaintext",
    "/techempower/db?queries=1",
    "/schema/validate"
  ];

  /**
   * 启动Elysia服务器并测量冷启动时间
   */
  private async startServerAndMeasureColdStart(): Promise<number> {
    console.log("🔄 启动 Elysia 服务器并测量冷启动时间...");
    
    const coldStartBegin = performance.now();
    
    return new Promise((resolve, reject) => {
      this.serverProcess = spawn("bun", ["run", "src/index.ts"], {
        cwd: "/Users/fuguoqiang/Desktop/vafast/vafast-benchmarks/frameworks/elysia",
        stdio: "pipe",
      });

      const checkServerReady = () => {
        http.get(`${this.serverUrl}/techempower/json`, (res) => {
          if (res.statusCode === 200) {
            const coldStartTime = performance.now() - coldStartBegin;
            console.log(`✅ 服务器启动成功，冷启动时间: ${coldStartTime.toFixed(2)}ms`);
            resolve(coldStartTime);
          }
        }).on("error", () => {
          setTimeout(checkServerReady, 50);
        });
      };

      setTimeout(checkServerReady, 500);
      
      setTimeout(() => {
        reject(new Error("服务器启动超时"));
      }, 10000);

      this.serverProcess.on("error", reject);
    });
  }

  /**
   * 发送HTTP请求并测量延迟
   */
  private async sendRequest(endpoint: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const startTime = performance.now();
      
      const isPostRequest = endpoint === "/schema/validate";
      const requestBody = isPostRequest ? JSON.stringify({
        user: {
          name: "Test User",
          phone: "13800138000",
          age: 25,
          email: "test@example.com",
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
      }) : null;

      const options = {
        hostname: "localhost",
        port: 3000,
        path: endpoint,
        method: isPostRequest ? "POST" : "GET",
        headers: {
          "Content-Type": "application/json",
          ...(requestBody && { "Content-Length": Buffer.byteLength(requestBody) })
        },
      };

      const req = http.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => data += chunk);
        res.on("end", () => {
          const latency = performance.now() - startTime;
          resolve(latency);
        });
      });

      req.on("error", reject);
      
      if (requestBody) {
        req.write(requestBody);
      }
      
      req.end();
    });
  }

  /**
   * 执行10秒性能测试
   */
  private async runPerformanceTest(): Promise<{ totalRequests: number; averageLatency: number }> {
    console.log("🔥 开始10秒性能测试...");
    
    const testDuration = 10 * 1000; // 10秒
    const startTime = performance.now();
    const endTime = startTime + testDuration;
    
    let totalRequests = 0;
    let totalLatency = 0;
    const concurrency = 5; // 并发数

    const sendConcurrentRequests = async () => {
      while (performance.now() < endTime) {
        try {
          const endpoint = this.testEndpoints[Math.floor(Math.random() * this.testEndpoints.length)];
          const latency = await this.sendRequest(endpoint);
          totalLatency += latency;
          totalRequests++;
        } catch (error) {
          console.error("请求失败:", error);
        }
      }
    };

    // 启动多个并发请求
    const promises = Array.from({ length: concurrency }, () => sendConcurrentRequests());
    await Promise.all(promises);

    const averageLatency = totalRequests > 0 ? totalLatency / totalRequests : 0;
    
    console.log(`📊 完成 ${totalRequests} 个请求，平均延迟: ${averageLatency.toFixed(2)}ms`);
    
    return { totalRequests, averageLatency };
  }

  /**
   * 停止服务器
   */
  private async stopServer(): Promise<void> {
    if (this.serverProcess) {
      console.log("🛑 停止服务器...");
      this.serverProcess.kill("SIGTERM");
      this.serverProcess = null;
    }
  }

  /**
   * 运行完整的性能测试Demo
   */
  async runDemo(): Promise<PerformanceResults> {
    try {
      console.log("🚀 Elysia 性能测试 Demo 开始");
      console.log("📍 测试端点:", this.testEndpoints.join(", "));
      
      // 1. 测量冷启动时间
      const coldStartTime = await this.startServerAndMeasureColdStart();
      
      // 2. 等待服务器稳定
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 3. 执行10秒性能测试
      const testStart = performance.now();
      const { totalRequests, averageLatency } = await this.runPerformanceTest();
      const testDuration = performance.now() - testStart;
      
      // 4. 计算RPS
      const requestsPerSecond = totalRequests / (testDuration / 1000);
      
      const results: PerformanceResults = {
        coldStartTime,
        totalRequests,
        requestsPerSecond,
        averageLatency,
        testDuration
      };
      
      this.printResults(results);
      return results;
      
    } catch (error) {
      console.error("❌ 测试失败:", error);
      throw error;
    } finally {
      await this.stopServer();
    }
  }

  /**
   * 打印测试结果
   */
  private printResults(results: PerformanceResults): void {
    console.log("\n" + "=".repeat(50));
    console.log("📊 Elysia 性能测试结果");
    console.log("=".repeat(50));
    console.log(`❄️  冷启动时间:     ${results.coldStartTime.toFixed(2)} ms`);
    console.log(`📈  总请求数:       ${results.totalRequests} 个`);
    console.log(`🚀  请求数/秒:      ${results.requestsPerSecond.toFixed(2)} RPS`);
    console.log(`⏱️  平均延迟:       ${results.averageLatency.toFixed(2)} ms`);
    console.log(`⏰  测试时长:       ${(results.testDuration / 1000).toFixed(1)} 秒`);
    console.log("=".repeat(50));
  }
}

// 主执行函数
async function main() {
  const demo = new ElysiaPerformanceDemo();
  
  try {
    await demo.runDemo();
  } catch (error) {
    console.error("Demo执行失败:", error);
    process.exit(1);
  }
}

// 如果直接运行此文件则执行demo
if (require.main === module) {
  main();
}

export { ElysiaPerformanceDemo, PerformanceResults };