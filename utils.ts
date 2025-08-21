// 完善的模拟工具函数 - 用于性能测试

// 类型定义
interface DatabaseItem {
  id: number;
  randomNumber: number;
  message: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

interface BatchItem {
  id: number;
  value: number;
  name: string;
  category?: string;
  tags?: string[];
}

interface BatchResult {
  operation: string;
  result: number;
  count: number;
  processingTime: number;
  timestamp: string;
}

// 模拟数据库查询 - 支持分页和过滤
export function simulateDatabaseQuery(queries: string | number | undefined): DatabaseItem[] {
  try {
    const count = Math.min(Math.max(parseInt(String(queries || "1")), 1), 1000); // 限制最大查询数量
    const results: DatabaseItem[] = [];

    for (let i = 0; i < count; i++) {
      results.push({
        id: i + 1,
        randomNumber: Math.floor(Math.random() * 10000) + 1,
        message: `Database record ${i + 1}`,
        timestamp: new Date().toISOString(),
        metadata: {
          version: "1.0.0",
          source: "simulated_db",
          index: i,
          checksum: `checksum_${i}_${Date.now()}`,
        },
      });
    }

    return results;
  } catch (error) {
    console.error("Database query simulation error:", error);
    return [
      {
        id: 1,
        randomNumber: 0,
        message: "Error occurred during query",
        timestamp: new Date().toISOString(),
      },
    ];
  }
}

// 模拟数据库更新 - 支持批量操作
export function simulateDatabaseUpdate(queries: string | number | undefined): DatabaseItem[] {
  try {
    const count = Math.min(Math.max(parseInt(String(queries || "1")), 1), 500); // 限制最大更新数量
    const results: DatabaseItem[] = [];

    for (let i = 0; i < count; i++) {
      results.push({
        id: i + 1,
        randomNumber: Math.floor(Math.random() * 10000) + 1,
        message: `Updated record ${i + 1} at ${new Date().toISOString()}`,
        timestamp: new Date().toISOString(),
        metadata: {
          operation: "UPDATE",
          affectedRows: 1,
          executionTime: Math.random() * 10 + 1,
          transactionId: `tx_${Date.now()}_${i}`,
        },
      });
    }

    return results;
  } catch (error) {
    console.error("Database update simulation error:", error);
    return [
      {
        id: 1,
        randomNumber: 0,
        message: "Update operation failed",
        timestamp: new Date().toISOString(),
      },
    ];
  }
}

// 模拟复杂JSON序列化 - 支持深度控制和类型变化
export function simulateComplexJsonSerialization(depth: string | number | undefined): any {
  try {
    const maxDepth = Math.min(Math.max(parseInt(String(depth || "3")), 1), 10); // 限制最大深度

    function createNestedObject(currentDepth: number, type: "object" | "array" = "object"): any {
      if (currentDepth >= maxDepth) {
        return type === "array" ? [] : "leaf";
      }

      if (type === "array") {
        return [
          currentDepth,
          `array-data-${currentDepth}`,
          createNestedObject(currentDepth + 1, "object"),
          Math.random() * 1000,
          new Date().toISOString(),
        ];
      }

      return {
        level: currentDepth,
        data: `nested-data-${currentDepth}`,
        nested: createNestedObject(currentDepth + 1, Math.random() > 0.5 ? "object" : "array"),
        array: Array.from({ length: Math.floor(Math.random() * 10) + 1 }, (_, i) => ({
          index: i,
          value: Math.random() * 100,
          label: `item-${i}`,
        })),
        timestamp: new Date().toISOString(),
        metadata: {
          depth: currentDepth,
          complexity: Math.pow(2, currentDepth),
          generated: Date.now(),
        },
      };
    }

    return createNestedObject(0);
  } catch (error) {
    console.error("Complex JSON serialization simulation error:", error);
    return {
      error: "Serialization failed",
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// 模拟批量数据处理 - 支持多种操作和性能统计
export function simulateBatchProcessing(body: {
  items: BatchItem[];
  operation: string;
}): BatchResult {
  try {
    const { items, operation } = body;
    const startTime = performance.now();

    if (!items || !Array.isArray(items)) {
      throw new Error("Invalid items array");
    }

    if (items.length === 0) {
      throw new Error("Items array cannot be empty");
    }

    if (items.length > 10000) {
      throw new Error("Items array too large (max 10,000)");
    }

    let result: number;

    switch (operation) {
      case "sum":
        result = items.reduce((sum: number, item: BatchItem) => {
          if (typeof item.value !== "number" || isNaN(item.value)) {
            throw new Error(`Invalid value for item ${item.id}`);
          }
          return sum + item.value;
        }, 0);
        break;

      case "average":
        const sum = items.reduce((sum: number, item: BatchItem) => {
          if (typeof item.value !== "number" || isNaN(item.value)) {
            throw new Error(`Invalid value for item ${item.id}`);
          }
          return sum + item.value;
        }, 0);
        result = sum / items.length;
        break;

      case "count":
        result = items.length;
        break;

      case "min":
        result = Math.min(
          ...items.map((item) => {
            if (typeof item.value !== "number" || isNaN(item.value)) {
              throw new Error(`Invalid value for item ${item.id}`);
            }
            return item.value;
          })
        );
        break;

      case "max":
        result = Math.max(
          ...items.map((item) => {
            if (typeof item.value !== "number" || isNaN(item.value)) {
              throw new Error(`Invalid value for item ${item.id}`);
            }
            return item.value;
          })
        );
        break;

      case "median":
        const sortedValues = items
          .map((item) => item.value)
          .filter((value) => typeof value === "number" && !isNaN(value))
          .sort((a, b) => a - b);
        const mid = Math.floor(sortedValues.length / 2);
        result =
          sortedValues.length % 2 === 0
            ? (sortedValues[mid - 1] + sortedValues[mid]) / 2
            : sortedValues[mid];
        break;

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    const processingTime = performance.now() - startTime;

    return {
      operation,
      result: Number(result.toFixed(6)), // 保留6位小数
      count: items.length,
      processingTime: Number(processingTime.toFixed(3)), // 保留3位小数
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Batch processing simulation error:", error);
    throw new Error(error instanceof Error ? error.message : "Unknown error");
  }
}

// 新增：模拟文件上传处理
export function simulateFileUpload(fileData: { name: string; size: number; type: string }): {
  success: boolean;
  fileId: string;
  url: string;
  metadata: Record<string, any>;
} {
  try {
    const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      success: true,
      fileId,
      url: `https://example.com/uploads/${fileId}`,
      metadata: {
        originalName: fileData.name,
        size: fileData.size,
        mimeType: fileData.type,
        uploadedAt: new Date().toISOString(),
        checksum: `checksum_${fileData.name}_${fileData.size}`,
        processingTime: Math.random() * 100 + 10,
      },
    };
  } catch (error) {
    console.error("File upload simulation error:", error);
    throw new Error("File upload simulation failed");
  }
}

// 新增：模拟缓存操作
export function simulateCacheOperation(
  operation: "get" | "set" | "delete",
  key: string,
  value?: any
): {
  success: boolean;
  operation: string;
  key: string;
  value?: any;
  timestamp: string;
} {
  try {
    const timestamp = new Date().toISOString();

    switch (operation) {
      case "get":
        return {
          success: true,
          operation: "GET",
          key,
          value: value || `cached_value_for_${key}`,
          timestamp,
        };

      case "set":
        return {
          success: true,
          operation: "SET",
          key,
          value,
          timestamp,
        };

      case "delete":
        return {
          success: true,
          operation: "DELETE",
          key,
          timestamp,
        };

      default:
        throw new Error(`Unknown cache operation: ${operation}`);
    }
  } catch (error) {
    console.error("Cache operation simulation error:", error);
    throw new Error("Cache operation simulation failed");
  }
}
