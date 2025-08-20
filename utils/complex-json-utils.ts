/**
 * 复杂对象序列化测试工具函数
 * 用于创建嵌套对象进行序列化性能测试
 */

/**
 * 创建嵌套对象用于序列化测试
 * @param currentDepth 当前嵌套深度
 * @returns 嵌套对象
 */
export function createNestedObject(currentDepth: number): any {
  if (currentDepth <= 0) {
    return {
      value: Math.floor(Math.random() * 1000),
      timestamp: new Date().toISOString(),
    };
  }

  return {
    level: currentDepth,
    data: createNestedObject(currentDepth - 1),
    metadata: {
      id: currentDepth,
      name: `Level ${currentDepth}`,
      active: currentDepth % 2 === 0,
    },
  };
}

/**
 * 复杂对象序列化测试
 * @param depth 嵌套深度，限制在1-10之间
 * @returns 嵌套对象
 */
export function simulateComplexJsonSerialization(depth: string | undefined) {
  const depthValue = parseInt(depth || "3");
  const limit = Math.min(Math.max(depthValue, 1), 10);

  return createNestedObject(limit);
}
