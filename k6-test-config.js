const http = require('k6/http');
const { check, sleep } = require('k6');
const { Rate, Trend, Counter, Gauge } = require('k6/metrics');

// 自定义指标
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');
const coldStartTime = new Trend('cold_start_time');
const requestsPerSecond = new Rate('requests_per_second');
const totalRequests = new Counter('total_requests');
const activeUsers = new Gauge('active_users');
const throughput = new Rate('throughput');

// 测试配置 - 基于k6官方最佳实践
exports.options = {
  // 定义阈值 - 确保性能目标
  thresholds: {
    // 可用性阈值 - 错误率必须小于1%
    http_req_failed: ['rate<0.01'],
    // 延迟阈值 - 99%的请求必须在1秒内完成
    http_req_duration: ['p(99)<1000'],
    // 自定义指标阈值
    'response_time': ['p(95)<300', 'p(99)<800'],
    'cold_start_time': ['p(95)<10'],
    // 吞吐量阈值
    'throughput': ['rate>1000'], // 至少1000 RPS
  },
  
  // 定义测试场景 - 专门针对最高性能测试
  scenarios: {
    // 峰值测试 - 优先执行，测试最大性能
    peak_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 200 },  // 快速增加到200用户
        { duration: '30s', target: 200 },  // 保持峰值30秒
        { duration: '10s', target: 0 },    // 快速减少到0
      ],
      gracefulRampDown: '5s',
      exec: 'peakTest',
    },
    
    // 快速测试 - 最后执行，验证基本功能
    quick_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '5s', target: 10 },    // 快速增加到10用户
        { duration: '10s', target: 10 },   // 保持10秒
        { duration: '5s', target: 0 },     // 快速减少到0
      ],
      gracefulRampDown: '3s',
      exec: 'quickTest',
    },
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

// 峰值测试函数
exports.peakTest = function() {
  runTest('peak');
}

// 快速测试函数
exports.quickTest = function() {
  runTest('quick');
}

// 通用测试函数
function runTest(testType) {
  const baseUrl = __ENV.BASE_URL || 'http://localhost:3005';
  const framework = __ENV.FRAMEWORK || 'Vafast-Mini';
  
  // 根据测试类型调整端点权重
  const endpoints = getEndpointsByTestType(testType);
  
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
    throughput.add(1);
    
    // 计算cold start时间（第一次请求的响应时间）
    if (firstRequestTime && firstRequestTime === startTime) {
      coldStartTime.add(responseTimeMs);
    }
    
    // 检查响应 - 基于k6官方最佳实践
    const success = check(response, {
      [`${endpoint.name} - 状态码是 200`]: (r) => r.status === 200,
      [`${endpoint.name} - 响应时间 < 500ms`]: (r) => r.timings.duration < 500,
      [`${endpoint.name} - 响应体不为空`]: (r) => r.body.length > 0,
      [`${endpoint.name} - 响应头包含Content-Type`]: (r) => r.headers['Content-Type'] !== undefined,
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
  
  // 根据测试类型调整用户思考时间
  const thinkTime = getThinkTimeByTestType(testType);
  if (thinkTime > 0) {
    sleep(thinkTime);
  }
}

// 根据测试类型获取端点配置
function getEndpointsByTestType(testType) {
  const baseEndpoints = [
    { path: '/techempower/json', method: 'GET', name: 'JSON序列化', weight: 1 },
    { path: '/techempower/plaintext', method: 'GET', name: '纯文本响应', weight: 1 },
    { path: '/techempower/db?queries=1', method: 'GET', name: '数据库查询', weight: 1 },
    { path: '/schema/validate', method: 'POST', name: 'Schema验证', body: testData.schemaValidation, weight: 1 },
  ];
  
  // 根据测试类型调整权重
  switch (testType) {
    case 'peak':
      return baseEndpoints.map(ep => ({ ...ep, weight: ep.weight * 0.3 })); // 峰值测试减少权重
    case 'quick':
      return baseEndpoints.map(ep => ({ ...ep, weight: ep.weight * 2 })); // 快速测试增加权重
    default:
      return baseEndpoints;
  }
}

// 根据测试类型获取思考时间
function getThinkTimeByTestType(testType) {
  switch (testType) {
    case 'peak':
      return Math.random() * 0.5 + 0.1; // 0.1-0.6秒
    case 'quick':
      return Math.random() * 1 + 0.5; // 0.5-1.5秒
    default:
      return Math.random() * 1 + 0.5;
  }
}

// 测试完成后的钩子 - 基于k6官方最佳实践
exports.handleSummary = function(data) {
  console.log('📊 测试完成，生成详细报告...');
  
  // 计算自定义指标
  const coldStart = data.metrics.cold_start_time?.values?.p95 || 0;
  const avgLatency = data.metrics.http_req_duration?.values?.avg || 0;
  const p95Latency = data.metrics.http_req_duration?.values?.['p(95)'] || 0;
  const p99Latency = data.metrics.http_req_duration?.values?.['p(99)'] || 0;
  const totalReq = data.metrics.http_reqs?.values?.count || 0;
  const testDuration = data.state.testRunDuration ? data.state.testRunDuration / 1000 : 10;
  const rps = data.metrics.http_reqs?.values?.rate || (totalReq / testDuration);
  const errorRateValue = data.metrics.http_req_failed?.values?.rate || 0;
  
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
    p95Latency: {
      emoji: "📊",
      name: "P95延迟",
      value: `${p95Latency.toFixed(2)} ms`,
      description: "95%的请求延迟都在此范围内"
    },
    p99Latency: {
      emoji: "🎯",
      name: "P99延迟",
      value: `${p99Latency.toFixed(2)} ms`,
      description: "99%的请求延迟都在此范围内"
    },
    errorRate: {
      emoji: "🚨",
      name: "错误率",
      value: `${(errorRateValue * 100).toFixed(3)}%`,
      description: "请求失败率，越低越好"
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
  console.log('='.repeat(60));
  
  Object.entries(formattedResults).forEach(([key, result]) => {
    console.log(`${result.emoji} ${result.name}`);
    console.log(`   ${result.value}`);
    console.log(`   ${result.description}`);
    console.log('');
  });
  
  // 性能评估
  console.log('📈 性能评估');
  console.log('='.repeat(30));
  
  if (rps > 30000) {
    console.log('🏆 极致性能: RPS超过30,000，性能表现卓越！');
  } else if (rps > 20000) {
    console.log('🥇 优秀性能: RPS超过20,000，性能表现优秀！');
  } else if (rps > 10000) {
    console.log('🥈 良好性能: RPS超过10,000，性能表现良好！');
  } else {
    console.log('🥉 一般性能: RPS低于10,000，有优化空间');
  }
  
  if (avgLatency < 1) {
    console.log('⚡️ 极速响应: 平均延迟低于1ms，响应速度极快！');
  } else if (avgLatency < 10) {
    console.log('🚀 快速响应: 平均延迟低于10ms，响应速度很快！');
  } else if (avgLatency < 100) {
    console.log('✅ 正常响应: 平均延迟低于100ms，响应速度正常');
  } else {
    console.log('⚠️ 响应较慢: 平均延迟超过100ms，需要优化');
  }
  
  // 返回JSON格式结果
  return {
    'k6-results.json': JSON.stringify(data, null, 2),
    'formatted-results.json': JSON.stringify(formattedResults, null, 2)
  };
}
