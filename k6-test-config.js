import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// 自定义指标
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');
const coldStartTime = new Trend('cold_start_time');
const requestsPerSecond = new Rate('requests_per_second');
const totalRequests = new Counter('total_requests');

// 测试配置
export const options = {
  // 阶段式负载测试
  stages: [
    { duration: '10s', target: 10 },    // 快速测试：10秒内增加到10个用户
  ],
  
  // 阈值设置
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],  // 95%请求在500ms内，99%在1000ms内
    http_req_failed: ['rate<0.01'],                   // 错误率小于1%
    'response_time': ['p(95)<300', 'p(99)<800'],      // 自定义响应时间阈值
    'cold_start_time': ['p(95)<10'],                   // Cold start时间阈值
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

// 记录第一次请求的时间
let firstRequestTime = null;
let isFirstRequest = true;

// 主测试函数
export default function () {
  const baseUrl = __ENV.BASE_URL || 'http://localhost:3005';
  const framework = __ENV.FRAMEWORK || 'Vafast-Mini';
  
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
  
  // 记录第一次请求的cold start时间
  if (isFirstRequest) {
    firstRequestTime = startTime;
    isFirstRequest = false;
  }
  
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
    totalRequests.add(1);
    
    // 计算cold start时间（第一次请求的响应时间）
    if (firstRequestTime && firstRequestTime === startTime) {
      coldStartTime.add(responseTimeMs);
    }
    
    // 检查响应
    const success = check(response, {
      [`${endpoint.name} - 状态码是 200`]: (r) => r.status === 200,
      [`${endpoint.name} - 响应时间 < 500ms`]: (r) => r.timings.duration < 500,
      [`${endpoint.name} - 响应体不为空`]: (r) => r.body.length > 0,
    });
    
    if (!success) {
      errorRate.add(1);
      // console.error(`❌ ${endpoint.name} 测试失败:`, response.status, response.body);
    } else {
      errorRate.add(0);
      // console.log(`✅ ${endpoint.name} 测试成功: ${responseTimeMs}ms`);
    }
    
  } catch (error) {
    errorRate.add(1);
    // console.error(`❌ ${endpoint.name} 请求异常:`, error.message);
  }
  
  // 模拟用户思考时间
  // sleep(Math.random() * 2 + 1);
}

// 测试完成后的钩子
export function handleSummary(data) {
  console.log('📊 测试完成，生成报告...');
  
  // 计算自定义指标
  const coldStart = data.metrics.cold_start_time && data.metrics.cold_start_time.values && data.metrics.cold_start_time.values.p95 ? data.metrics.cold_start_time.values.p95 : 0;
  const avgLatency = data.metrics.http_req_duration && data.metrics.http_req_duration.values && data.metrics.http_req_duration.values.avg ? data.metrics.http_req_duration.values.avg : 0;
  const totalReq = data.metrics.http_reqs && data.metrics.http_reqs.values && data.metrics.http_reqs.values.count ? data.metrics.http_reqs.values.count : 0;
  const testDuration = data.state.testRunDuration ? data.state.testRunDuration / 1000 : 10; // 转换为秒，默认10秒
  const rps = data.metrics.http_reqs && data.metrics.http_reqs.values && data.metrics.http_reqs.values.rate ? data.metrics.http_reqs.values.rate : (totalReq / testDuration);
  
  // 生成格式化的结果
  const formattedResults = {
    coldStart: {
      emoji: "👑",
      name: "冷启动",
      value: `${coldStart.toFixed(2)} ms`,
      description: `${coldStart.toFixed(2)} ms. 无延迟，无妥协。冷启动王者之冠属于我们。`
    },
    requestsPerSecond: {
      emoji: "⚡️",
      name: "每秒请求数",
      value: `${rps.toLocaleString()} rps`,
      description: "为瞬时流量而生 — 无需预热。"
    },
    avgLatency: {
      emoji: "📉",
      name: "平均延迟",
      value: `${avgLatency.toFixed(2)} ms`,
      description: "压力之下依然迅捷。始终如一。"
    },
    totalRequests: {
      emoji: "🎯",
      name: "总请求数",
      value: `${totalReq.toLocaleString()} req / ${testDuration.toFixed(0)}s`,
      description: `在${testDuration.toFixed(0)}秒内完成的总请求数`
    }
  };
  
  // 生成控制台输出
  console.log('\n🚀 性能测试结果 🚀');
  console.log('='.repeat(50));
  
  Object.entries(formattedResults).forEach(([key, result]) => {
    console.log(`${result.emoji} ${result.name}`);
    console.log(`${result.value}`);
    console.log(`${result.description}`);
    console.log('');
  });
  
  // 返回JSON格式结果
  return {
    'k6-results.json': JSON.stringify(data, null, 2),
    'formatted-results.json': JSON.stringify(formattedResults, null, 2)
  };
}
