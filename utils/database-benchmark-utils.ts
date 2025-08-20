/**
 * 数据库基准测试工具函数
 * 用于模拟TechEmpower风格的数据库测试
 */

/**
 * 模拟数据库查询测试
 * @param queries 查询数量，限制在1-500之间
 * @returns 查询结果数组或单个结果
 */
export function simulateDatabaseQuery(queries: string | undefined) {
  const queryCount = parseInt(queries || "1");
  const limit = Math.min(Math.max(queryCount, 1), 500); // 限制在1-500之间

  // 模拟数据库查询
  const results = Array.from({ length: limit }, (_, i) => ({
    id: i + 1,
    randomNumber: Math.floor(Math.random() * 10000) + 1,
  }));

  return limit === 1 ? results[0] : results;
}

/**
 * 模拟数据库更新测试
 * @param queries 更新数量，限制在1-500之间
 * @returns 更新结果数组或单个结果
 */
export function simulateDatabaseUpdate(queries: string | undefined) {
  const queryCount = parseInt(queries || "1");
  const limit = Math.min(Math.max(queryCount, 1), 500); // 限制在1-500之间

  // 模拟数据库更新
  const results = Array.from({ length: limit }, (_, i) => ({
    id: i + 1,
    randomNumber: Math.floor(Math.random() * 10000) + 1,
  }));

  return limit === 1 ? results[0] : results;
}
