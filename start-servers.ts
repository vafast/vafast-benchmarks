import { spawn, ChildProcess } from "child_process";
import { join } from "path";

interface FrameworkConfig {
  name: string;
  displayName: string;
  directory: string;
  startCommand: string[];
  port: number;
}

class ServerManager {
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
  async startFrameworkServer(config: FrameworkConfig): Promise<boolean> {
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
        if (
          !started &&
          (output.includes("Server running") ||
            output.includes("listening") ||
            output.includes("running at") ||
            output.includes("🚀 Elysia is running") ||
            output.includes("Server started") ||
            output.includes("Ready"))
        ) {
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
  async waitForServerReady(port: number, timeout: number = 30000): Promise<boolean> {
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
      const http = require("http");
      const req = http.get(url, (res: any) => {
        let body = "";
        res.on("data", (chunk: any) => (body += chunk));
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
   * 启动所有服务器
   */
  async startAllServers(): Promise<void> {
    console.log("🚀 开始启动所有框架服务器...\n");

    for (const config of this.frameworkConfigs) {
      try {
        const serverStarted = await this.startFrameworkServer(config);
        if (!serverStarted) {
          console.log(`❌ ${config.displayName} 服务器启动失败`);
          continue;
        }

        // 等待服务器就绪
        const serverReady = await this.waitForServerReady(config.port);
        if (!serverReady) {
          console.log(`❌ ${config.displayName} 服务器未就绪`);
          continue;
        }

        console.log(`✅ ${config.displayName} 服务器已就绪\n`);
      } catch (error) {
        console.error(`❌ ${config.displayName} 启动异常:`, error);
      }
    }

    console.log("🎉 所有服务器启动完成！");
    console.log("\n📊 服务器状态:");
    for (const config of this.frameworkConfigs) {
      const isRunning = this.servers.has(config.name);
      console.log(
        `  ${isRunning ? "✅" : "❌"} ${config.displayName}: http://localhost:${config.port}`
      );
    }
  }

  /**
   * 停止所有服务器
   */
  async stopAllServers(): Promise<void> {
    console.log("\n🛑 停止所有服务器...");

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
   * 获取服务器状态
   */
  getServerStatus(): Array<{ name: string; port: number; running: boolean }> {
    return this.frameworkConfigs.map((config) => ({
      name: config.displayName,
      port: config.port,
      running: this.servers.has(config.name),
    }));
  }

  /**
   * 获取框架配置列表
   */
  getFrameworkConfigs(): FrameworkConfig[] {
    return this.frameworkConfigs;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const manager = new ServerManager();

  // 处理进程信号
  process.on("SIGINT", async () => {
    console.log("\n🛑 收到中断信号，正在停止所有服务器...");
    await manager.stopAllServers();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log("\n🛑 收到终止信号，正在停止所有服务器...");
    await manager.stopAllServers();
    process.exit(0);
  });

  // 启动所有服务器
  manager.startAllServers().catch(console.error);
}

export default ServerManager;
