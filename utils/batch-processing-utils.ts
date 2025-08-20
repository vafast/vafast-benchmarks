/**
 * 批量数据处理测试工具函数
 * 用于模拟批量数据处理的性能测试
 */

export interface BatchItem {
  id: number;
  value: number;
  name: string;
}

export interface BatchProcessRequest {
  items: BatchItem[];
  operation: "sum" | "average" | "count";
}

export interface BatchProcessResult {
  operation: string;
  totalItems: number;
  processedItems: number;
  totalValue: number;
  averageValue: number;
  processingTime: string;
  timestamp: string;
}

/**
 * 批量数据处理测试
 * @param body 包含items和operation的请求体
 * @returns 处理结果
 */
export function simulateBatchProcessing(body: BatchProcessRequest): BatchProcessResult {
  const start = performance.now();

  const { items, operation } = body;
  const itemCount = items?.length || 0;

  if (itemCount === 0) {
    throw new Error("No items provided");
  }

  // 模拟批量处理
  let processedItems = 0;
  let totalValue = 0;

  for (let i = 0; i < itemCount; i++) {
    const item = items[i];
    if (item && typeof item.value === "number") {
      totalValue += item.value;
      processedItems++;
    }
  }

  const end = performance.now();
  const processingTime = end - start;

  return {
    operation,
    totalItems: itemCount,
    processedItems,
    totalValue,
    averageValue: processedItems > 0 ? totalValue / processedItems : 0,
    processingTime: `${processingTime.toFixed(2)}ms`,
    timestamp: new Date().toISOString(),
  };
}
