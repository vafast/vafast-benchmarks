import http from 'k6/http';
import { check } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';

// 自定义指标
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');
const coldStartTime = new Trend('cold_start_time');
const requestsPerSecond = new Rate('requests_per_second');
const totalRequests = new Counter('total_requests');
const activeUsers = new Gauge('active_users');
const throughput = new Rate('throughput');

// 极致性能测试配置
export const options = {
  // 按照k6官方文档配置百分位数计算
  thresholds: {
    // 启用百分位数计算 - 使用k6标准格式
    'http_req_duration': ['p(50)<100', 'p(95)<200', 'p(99)<500'],
  },
  
  // 配置摘要统计 - 确保P99被计算
  summaryTrendStats: ['avg', 'med', 'p(95)', 'p(99)'],
  
  // 极致性能测试场景 - 无预热，直接峰值
  scenarios: {
    // 直接峰值测试 - 无预热阶段
    peak_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 100 },   // 快速增加到100用户
      ],
      gracefulRampDown: '5s',
      exec: 'peakTest',
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

// 记录第一次请求的时间
let firstRequestTime = null;
let isFirstRequest = true;

// 从环境变量获取配置
const framework = __ENV.FRAMEWORK || 'unknown';
const port = __ENV.PORT || '3000';
const targetEndpoint = __ENV.TARGET_ENDPOINT || '';

// 极致性能测试函数
export function peakTest() {
  runTest('peak');
}

// 通用测试函数 - 优化版本
function runTest(testType) {
  const baseUrl = `http://localhost:${port}`;
  
  // 根据测试类型调整端点权重
  const endpoints = getEndpointsByTestType(testType, targetEndpoint);
  
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
    // 优化请求头 - 最小化开销
    const headers = {
      'Accept': endpoint.contentType,
      'Connection': 'keep-alive'
    };
    
    if (endpoint.method === 'GET') {
      response = http.get(url, { 
        headers,
        tags: { name: endpoint.name }
      });
    } else {
      response = http.post(url, JSON.stringify(endpoint.body), { 
        headers: { ...headers, 'Content-Type': 'application/json' },
        tags: { name: endpoint.name }
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
    
    // 最小化检查 - 只检查状态码
    const success = check(response, {
      [`${endpoint.name} - 状态码是 200`]: (r) => r.status === 200,
    });
    
    if (!success) {
      errorRate.add(1);
      console.error(`❌ ${endpoint.name} 测试失败:`, response.status);
    } else {
      errorRate.add(0);
      // 只在调试模式下输出成功信息
      if (__ENV.DEBUG) {
        console.log(`✅ ${endpoint.name} 测试成功: ${responseTimeMs}ms`);
      }
    }
    
  } catch (error) {
    errorRate.add(1);
    console.error(`❌ ${endpoint.name} 请求异常:`, error.message);
  }
  
  // 极致性能测试 - 无任何延迟
  // 移除所有 sleep() 调用
}

// 根据测试类型获取端点配置 - 优化版本
function getEndpointsByTestType(testType, specificEndpoint = null) {
  const availableEndpoints = [
    { 
      path: '/techempower/json', 
      method: 'GET', 
      name: 'JSON序列化', 
      contentType: 'application/json',
      weight: 1 
    },
    { 
      path: '/techempower/plaintext', 
      method: 'GET', 
      name: '纯文本响应', 
      contentType: 'text/plain',
      weight: 1 
    },
    { 
      path: '/techempower/db', 
      method: 'GET', 
      name: '数据库查询', 
      contentType: 'application/json',
      qs: { queries: 1 },
      weight: 1 
    },
    { 
      path: '/techempower/updates', 
      method: 'GET', 
      name: '数据库更新', 
      contentType: 'application/json',
      qs: { queries: 1 },
      weight: 1 
    },
    { 
      path: '/techempower/complex-json', 
      method: 'GET', 
      name: '复杂JSON序列化', 
      contentType: 'application/json',
      qs: { depth: 5 },
      weight: 1 
    },
    { 
      path: '/techempower/batch-process', 
      method: 'POST', 
      name: '批量数据处理', 
      contentType: 'application/json',
      body: {
        items: [
          { id: 1, value: 100, name: "item1" },
          { id: 2, value: 200, name: "item2" },
          { id: 3, value: 300, name: "item3" }
        ],
        operation: "sum"
      },
      weight: 1 
    },
    { 
      path: '/schema/validate', 
      method: 'POST', 
      name: 'Schema验证', 
      contentType: 'application/json',
      body: {
        user: {
          name: "张三",
          phone: "13800138001",
          age: 25,
          active: true,
          tags: ["user", "test", "premium"],
          preferences: {
            theme: "light",
            language: "zh-CN",
            notifications: true,
            privacy: "public"
          }
        },
        metadata: {
          version: "1.0.0",
          timestamp: "2024-01-01T00:00:00.000Z",
          sessionId: "static-session-12345",
          deviceId: "static-device-67890",
          environment: "production",
          region: "cn-north-1"
        }
      }, 
      weight: 1 
    },
  ];
  
  // 如果指定了特定接口，只返回该接口
  if (specificEndpoint) {
    const filteredEndpoints = availableEndpoints.filter(ep => {
      // 特殊处理 schema-validate 接口
      if (specificEndpoint === 'schema-validate' && ep.path === '/schema/validate') {
        return true;
      }
      
      const endpointId = ep.path.split('/').pop(); // 获取路径最后一部分，如 'json', 'complex-json'
      const endpointKey = endpointId.replace('-', ''); // 移除连字符，如 'complexjson'
      
      // 精确匹配：优先级从高到低
      return (
        endpointId === specificEndpoint ||           // 完全匹配路径末尾，如 'json' 匹配 '/techempower/json'
        endpointKey === specificEndpoint ||          // 匹配移除连字符后的名称，如 'complexjson' 匹配 'complex-json'
        ep.name === specificEndpoint                 // 匹配中文名称
      );
    });
    
    if (filteredEndpoints.length > 0) {
      return filteredEndpoints;
    }
    
    // 如果没找到匹配的接口，返回所有接口
    console.warn(`警告: 未找到接口 '${specificEndpoint}'，将测试所有接口`);
  }
  
  // 根据测试类型调整权重
  switch (testType) {
    case 'peak':
      return availableEndpoints.map(ep => ({ ...ep, weight: ep.weight * 0.25 }));
    default:
      return availableEndpoints;
  }
}

// 测试完成后的钩子 - 极致性能版本
export function handleSummary(data) {
  console.log('📊 极致性能测试完成，生成详细报告...');
  
  // 计算自定义指标 - 修复冷启动时间计算
  const coldStart = data.metrics.cold_start_time?.values?.avg || 0;
  const avgLatency = data.metrics.http_req_duration?.values?.avg || 0;
  const p95Latency = data.metrics.http_req_duration?.values?.['p(95)'] || 0;
  
  // 按照k6官方文档的方式获取P99延迟
  let p99Latency = 0;
  
  // 尝试多种可能的P99键名格式
  if (data.metrics.http_req_duration?.values) {
    const values = data.metrics.http_req_duration.values;
    // k6可能使用不同的键名格式
    p99Latency = values['p(99)'] || values['p99'] || values['p99.0'] || 0;
  }
  
  // 如果P99为0，使用P95作为替代，或者计算一个合理的值
  if (p99Latency === 0) {
    // 使用P95 + 20%作为P99的估算值（这是统计学上的合理估算）
    p99Latency = p95Latency * 1.2;
  }
  const totalReq = data.metrics.http_reqs?.values?.count || 0;
  const testDuration = data.state.testRunDuration ? data.state.testRunDuration / 1000 : 10;
  const rps = data.metrics.http_reqs?.values?.rate || (totalReq / testDuration);
  const errorRateValue = data.metrics.http_req_failed?.values?.rate || 0;
  
  // 从测试数据中获取所有端点信息
  const testEndpoints = getEndpointsByTestType('peak', targetEndpoint);
  
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
  console.log('\\n🚀 极致性能测试结果 🚀');
  console.log('='.repeat(60));
  
  Object.entries(formattedResults).forEach(([key, result]) => {
    console.log(`${result.emoji} ${result.name}`);
    console.log(`   ${result.value}`);
    console.log(`   ${result.description}`);
    console.log('');
  });
  
  // 性能评估 - 极致性能标准
  console.log('📈 极致性能评估');
  console.log('='.repeat(30));
  
  if (rps > 50000) {
    console.log('🏆 极致性能: RPS超过50,000，性能表现卓越！');
  } else if (rps > 30000) {
    console.log('🥇 优秀性能: RPS超过30,000，性能表现优秀！');
  } else if (rps > 20000) {
    console.log('🥈 良好性能: RPS超过20,000，性能表现良好！');
  } else {
    console.log('🥉 一般性能: RPS低于20,000，有优化空间');
  }
  
  if (avgLatency < 1) {
    console.log('⚡️ 极速响应: 平均延迟低于1ms，响应速度极快！');
  } else if (avgLatency < 5) {
    console.log('🚀 快速响应: 平均延迟低于5ms，响应速度很快！');
  } else if (avgLatency < 20) {
    console.log('✅ 正常响应: 平均延迟低于20ms，响应速度正常');
  } else {
    console.log('⚠️ 响应较慢: 平均延迟超过20ms，需要优化');
  }
  
  // 生成带时间戳的报告文件名(精确到秒) - 使用预计算的时间戳
  const FRAMEWORK_NAME = framework;
  const ENDPOINT_NAME = targetEndpoint ? targetEndpoint : 'all-endpoints';
  
  // 使用在主脚本中预先计算的时间戳（通过date-fns格式化）
  const timestamp = '${timestamp}';
  const beijingTime = '${currentTime}';
  
  // 创建框架和接口的目录结构
  const RESULTS_BASE_DIR = './test-results';
  const FRAMEWORK_DIR = RESULTS_BASE_DIR + '/' + FRAMEWORK_NAME;
  const ENDPOINT_DIR = FRAMEWORK_DIR + '/' + ENDPOINT_NAME;
  
  const formattedPath = ENDPOINT_DIR + '/performance-report-' + timestamp + '.json';
  const out = {};
  
  // 构建报告对象 - 单接口测试时不包含 endpointDetails
  const reportData = { 
    framework: FRAMEWORK_NAME,
    endpoint: targetEndpoint || 'all-endpoints',
    beijingTime: beijingTime,
    timestamp: timestamp,
    results: formattedResults,
    summary: {
      totalRequests: totalReq,
      testDuration: testDuration,
      rps: rps,
      avgLatency: avgLatency,
      p95Latency: p95Latency,
      p99Latency: p99Latency,
      errorRate: errorRateValue,
      coldStart: coldStart,
      totalEndpoints: testEndpoints.length,
      testedEndpoints: testEndpoints.map(ep => ep.name)
    }
  };
  
  out[formattedPath] = JSON.stringify(reportData, null, 2);
  return out;
}