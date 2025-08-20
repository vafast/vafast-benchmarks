/**
 * 性能测试工具函数
 */

// ============================================================================
// 测试配置
// ============================================================================
export const TEST_CONFIG = {
  iterations: 100_000, // 统一测试次数
  warmupRequests: 5000, // 预热请求数
};

// ============================================================================
// 内存监控和垃圾回收
// ============================================================================

// 新增：内存监控函数
export function getMemoryUsage(): { used: number; total: number; percentage: number } {
  if (typeof process !== "undefined" && process.memoryUsage) {
    const mem = process.memoryUsage();
    const used = Math.round(mem.heapUsed / 1024 / 1024);
    const total = Math.round(mem.heapTotal / 1024 / 1024);
    const percentage = Math.round((used / total) * 100);
    return { used, total, percentage };
  }
  return { used: 0, total: 0, percentage: 0 };
}

// 新增：强制垃圾回收函数
export function forceGarbageCollection(): void {
  if (typeof global !== "undefined" && (global as any).gc) {
    // 多次垃圾回收确保彻底清理
    (global as any).gc();
    (global as any).gc();
    (global as any).gc();
  }
}

// 深度内存清理和系统稳定化
export async function deepMemoryCleanup(): Promise<void> {
  console.log("🧹 执行深度内存清理...");

  // 强制垃圾回收
  forceGarbageCollection();

  // 等待内存稳定
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // 再次垃圾回收
  forceGarbageCollection();

  // 等待系统稳定
  await new Promise((resolve) => setTimeout(resolve, 5000));

  console.log("✅ 内存清理完成");
}

// 新增：内存使用报告
export function logMemoryUsage(stage: string): void {
  const mem = getMemoryUsage();
  console.log(`💾 ${stage} - 内存使用: ${mem.used}MB / ${mem.total}MB (${mem.percentage}%)`);
}

// ============================================================================
// 通用性能测试函数
// ============================================================================

// 通用性能测试函数
export async function benchmark(
  name: string,
  handler: (req: Request) => Response | Promise<Response>,
  iterations: number = TEST_CONFIG.iterations
) {
  const baseUrl = "http://localhost:3000/";
  const baseHeaders = { "content-type": "application/json" };
  const bodyData = JSON.stringify({
    user: {
      id: "12345",
      name: "John Doe",
      email: "john@example.com",
      age: 30,
      profile: {
        bio: "Software Developer",
        avatar: "https://example.com/avatar.jpg",
        preferences: {
          theme: "dark",
          notifications: true,
          language: "en",
        },
      },
      tags: ["developer", "typescript", "nodejs"],
      metadata: {
        lastLogin: "2024-01-01T00:00:00Z",
        role: "admin",
      },
    },
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });

  // 预热
  for (let i = 0; i < TEST_CONFIG.warmupRequests; i++) {
    const testRequest = new Request(baseUrl, {
      method: "POST",
      headers: baseHeaders,
      body: bodyData,
    });
    await handler(testRequest);
  }

  // 强制垃圾回收
  forceGarbageCollection();

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const testRequest = new Request(baseUrl, {
      method: "POST",
      headers: baseHeaders,
      body: bodyData,
    });
    await handler(testRequest);
  }
  const end = performance.now();

  const duration = end - start;
  const rps = Math.round(iterations / (duration / 1000));

  return { name, rps, duration };
}
