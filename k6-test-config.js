import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// 自定义指标
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');

// 测试配置
export const options = {
  // 阶段式负载测试
  stages: [
    { duration: '30s', target: 10 },    // 预热阶段：30秒内增加到10个用户
    { duration: '1m', target: 50 },     // 爬升阶段：1分钟内增加到50个用户
    { duration: '2m', target: 50 },     // 稳定阶段：2分钟保持50个用户
    { duration: '30s', target: 100 },   // 峰值阶段：30秒内增加到100个用户
    { duration: '1m', target: 100 },    // 峰值保持：1分钟保持100个用户
    { duration: '30s', target: 0 },     // 下降阶段：30秒内减少到0个用户
  ],
  
  // 阈值设置
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],  // 95%请求在500ms内，99%在1000ms内
    http_req_failed: ['rate<0.01'],                   // 错误率小于1%
    'response_time': ['p(95)<300', 'p(99)<800'],      // 自定义响应时间阈值
  },
  
  // 输出配置
  ext: {
    loadimpact: {
      distribution: {
        '测试环境': { loadZone: 'amazon:us:ashburn', percent: 100 },
      },
    },
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
  
  // 测试端点配置
  const endpoints = [
    { path: '/techempower/json', method: 'GET', name: 'JSON序列化' },
    { path: '/techempower/plaintext', method: 'GET', name: '纯文本响应' },
    { path: '/techempower/db?queries=1', method: 'GET', name: '数据库查询' },
    { path: '/schema/validate', method: 'POST', name: 'Schema验证', body: testData.schemaValidation },
  ];
  
  // 随机选择一个端点进行测试
  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  const url = `${baseUrl}${endpoint.path}`;
  
  let response;
  const startTime = Date.now();
  
  try {
    if (endpoint.method === 'GET') {
      response = http.get(url);
    } else {
      response = http.post(url, JSON.stringify(endpoint.body), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const responseTimeMs = Date.now() - startTime;
    responseTime.add(responseTimeMs);
    
    // 检查响应
    const success = check(response, {
      [`${endpoint.name} - 状态码是 200`]: (r) => r.status === 200,
      [`${endpoint.name} - 响应时间 < 500ms`]: (r) => r.timings.duration < 500,
      [`${endpoint.name} - 响应体不为空`]: (r) => r.body.length > 0,
    });
    
    if (!success) {
      errorRate.add(1);
      console.error(`❌ ${endpoint.name} 测试失败:`, response.status, response.body);
    } else {
      errorRate.add(0);
      console.log(`✅ ${endpoint.name} 测试成功: ${responseTimeMs}ms`);
    }
    
  } catch (error) {
    errorRate.add(1);
    console.error(`❌ ${endpoint.name} 请求异常:`, error.message);
  }
  
  // 模拟用户思考时间
  // sleep(Math.random() * 2 + 1);
}

// 测试完成后的钩子
export function handleSummary(data) {
  console.log('📊 测试完成，生成报告...');
  
  return {
    'k6-results.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

// 文本摘要函数
function textSummary(data, options) {
  const { metrics, root_group } = data;
  
  let summary = '\n📈 K6 性能测试报告\n';
  summary += '='.repeat(50) + '\n\n';
  
  // HTTP 请求统计
  if (metrics.http_reqs) {
    summary += `🌐 HTTP 请求统计:\n`;
    summary += `  总请求数: ${metrics.http_reqs.count}\n`;
    summary += `  请求速率: ${metrics.http_reqs.rate.toFixed(2)} req/s\n`;
    summary += `  平均响应时间: ${metrics.http_req_duration.avg.toFixed(2)}ms\n`;
    summary += `  P95响应时间: ${metrics.http_req_duration.values['p(95)'].toFixed(2)}ms\n`;
    summary += `  P99响应时间: ${metrics.http_req_duration.values['p(99)'].toFixed(2)}ms\n`;
    summary += `  错误率: ${(metrics.http_req_failed.rate * 100).toFixed(2)}%\n\n`;
  }
  
  // 自定义指标
  if (metrics.response_time) {
    summary += `⏱️  自定义响应时间:\n`;
    summary += `  平均: ${metrics.response_time.avg.toFixed(2)}ms\n`;
    summary += `  中位数: ${metrics.response_time.med.toFixed(2)}ms\n`;
    summary += `  P95: ${metrics.response_time.values['p(95)'].toFixed(2)}ms\n`;
    summary += `  P99: ${metrics.response_time.values['p(99)'].toFixed(2)}ms\n\n`;
  }
  
  // 测试配置
  summary += `⚙️  测试配置:\n`;
  summary += `  框架: ${__ENV.FRAMEWORK || 'elysia'}\n`;
  summary += `  基础URL: ${__ENV.BASE_URL || 'http://localhost:3000'}\n`;
  summary += `  测试时长: ${data.state.testRunDuration / 1000}s\n\n`;
  
  summary += '='.repeat(50) + '\n';
  
  return summary;
}
