import http from 'k6/http';
import { check, sleep } from 'k6';

// 快速测试配置
export const options = {
  // 快速测试：30秒内从1个用户增加到10个用户
  stages: [
    { duration: '10s', target: 5 },     // 10秒内增加到5个用户
    { duration: '15s', target: 10 },    // 15秒内增加到10个用户
    { duration: '5s', target: 0 },      // 5秒内减少到0个用户
  ],
  
  // 阈值设置
  thresholds: {
    http_req_duration: ['p(95)<1000'],  // 95%请求在1000ms内
    http_req_failed: ['rate<0.05'],     // 错误率小于5%
  },
};

// 测试数据
const testData = {
  schemaValidation: {
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
  },
};

// 主测试函数
export default function () {
  const baseUrl = __ENV.BASE_URL || 'http://localhost:3000';
  const framework = __ENV.FRAMEWORK || 'elysia';
  
  // 测试端点
  const endpoints = [
    { path: '/techempower/json', method: 'GET', name: 'JSON序列化' },
    { path: '/techempower/plaintext', method: 'GET', name: '纯文本响应' },
    { path: '/techempower/db?queries=1', method: 'GET', name: '数据库查询' },
    { path: '/schema/validate', method: 'POST', name: 'Schema验证', body: testData.schemaValidation },
  ];
  
  // 随机选择端点
  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  const url = `${baseUrl}${endpoint.path}`;
  
  let response;
  
  try {
    if (endpoint.method === 'GET') {
      response = http.get(url);
    } else {
      response = http.post(url, JSON.stringify(endpoint.body), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // 检查响应
    check(response, {
      [`${endpoint.name} - 状态码是 200`]: (r) => r.status === 200,
      [`${endpoint.name} - 响应时间 < 1000ms`]: (r) => r.timings.duration < 1000,
      [`${endpoint.name} - 响应体不为空`]: (r) => r.body.length > 0,
    });
    
  } catch (error) {
    console.error(`❌ ${endpoint.name} 请求异常:`, error.message);
  }
  
  // 随机等待时间
  sleep(Math.random() * 1 + 0.5);
}

// 测试完成后的钩子
export function handleSummary(data) {
  console.log('\n📊 快速测试完成');
  console.log('='.repeat(40));
  
  if (data.metrics.http_reqs) {
    console.log(`总请求数: ${data.metrics.http_reqs.count}`);
    console.log(`请求速率: ${data.metrics.http_reqs.rate.toFixed(2)} req/s`);
    console.log(`平均响应时间: ${data.metrics.http_req_duration.avg.toFixed(2)}ms`);
    console.log(`P95响应时间: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms`);
    console.log(`错误率: ${(data.metrics.http_req_failed.rate * 100).toFixed(2)}%`);
  }
  
  console.log('='.repeat(40));
  
  return {
    'k6-quick-results.json': JSON.stringify(data, null, 2),
  };
}
