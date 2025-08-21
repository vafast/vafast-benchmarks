#!/usr/bin/env node

/**
 * K6 完全集成测试脚本
 * 支持单独测试一个框架，命令行风格：node run-k6-tests.js elysia
 * 所有测试配置和逻辑都集成在一个文件中
 */

import { spawn } from 'child_process';
import fs from 'fs';

// 测试配置 - 与 start-servers.ts 保持一致
const TEST_CONFIGS = {
  'vafast-mini': {
    port: 3005,
    description: 'Vafast Mini 框架测试'
  },
  'vafast': {
    port: 3004,
    description: 'Vafast 框架测试'
  },
  'express': {
    port: 3002,
    description: 'Express 框架测试'
  },
  'koa': {
    port: 3003,
    description: 'Koa 框架测试'
  },
  'hono': {
    port: 3001,
    description: 'Hono 框架测试'
  },
  'elysia': {
    port: 3000,
    description: 'Elysia 框架测试'
  }
};

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logHeader(message) {
  log('\n' + '='.repeat(60), 'cyan');
  log(`🚀 ${message}`, 'bright');
  log('='.repeat(60), 'cyan');
}

function logSubHeader(message) {
  log('\n' + '-'.repeat(50), 'yellow');
  log(`⚡️ ${message}`, 'yellow');
  log('-'.repeat(50), 'yellow');
}

function logStep(message) {
  log(`\n📋 ${message}`, 'yellow');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'magenta');
}

function logPerformance(message) {
  log(`🏆 ${message}`, 'cyan');
}

// 检查 K6 是否安装
function checkK6() {
  return new Promise((resolve, reject) => {
    const check = spawn('k6', ['version'], { stdio: 'pipe' });
    
    check.on('close', (code) => {
      if (code === 0) {
        resolve(true);
      } else {
        reject(new Error('K6 未安装'));
      }
    });
    
    check.on('error', () => {
      reject(new Error('K6 未安装'));
    });
  });
}

// 安装 K6
function installK6() {
  return new Promise((resolve, reject) => {
    logStep('正在安装 K6...');
    
    // 尝试使用 brew 安装
    const install = spawn('brew', ['install', 'k6'], { stdio: 'inherit' });
    
    install.on('close', (code) => {
      if (code === 0) {
        logSuccess('K6 安装成功！');
        resolve();
      } else {
        // 如果 brew 失败，尝试其他方法
        logInfo('Brew 安装失败，尝试其他方法...');
        const installAlt = spawn('curl', ['-L', 'https://github.com/grafana/k6/releases/latest/download/k6-latest-amd64.deb', '-o', 'k6.deb'], { stdio: 'inherit' });
        
        installAlt.on('close', (code) => {
          if (code === 0) {
            logSuccess('K6 下载成功，请手动安装');
            resolve();
          } else {
            reject(new Error('K6 安装失败'));
          }
        });
      }
    });
  });
}

// 生成 K6 测试配置内容
function generateK6Config(framework, port) {
  return generateUltimateConfig(framework, port);
}

// 生成极致性能测试配置
function generateUltimateConfig(framework, port) {
  return `import http from 'k6/http';
import { check } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import fs from 'fs';

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
  // 定义阈值 - 极致性能要求
  thresholds: {
    http_req_failed: ['rate<0.001'],        // 错误率必须小于0.1%
    http_req_duration: ['p(99)<500'],       // 99%的请求必须在500ms内完成
    'response_time': ['p(95)<200', 'p(99)<400'],
    'cold_start_time': ['p(95)<5'],         // 冷启动时间必须小于5ms
    'throughput': ['rate>50000'],           // 至少50,000 RPS
  },
  
  // 极致性能测试场景 - 无预热，直接峰值
  scenarios: {
    // 直接峰值测试 - 无预热阶段
    peak_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 500 },   // 快速增加到500用户
        { duration: '30s', target: 500 },   // 保持500用户30秒
        { duration: '20s', target: 1000 },  // 增加到1000用户
        { duration: '30s', target: 1000 },  // 保持1000用户30秒
        { duration: '20s', target: 2000 },  // 增加到2000用户
        { duration: '30s', target: 2000 },  // 保持2000用户30秒
        { duration: '10s', target: 0 },     // 快速减少到0
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

// 静态测试数据 - 确保测试公平性
const testData = {
  schemaValidation: {
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
      },
    },
    metadata: {
      version: "1.0.0",
      timestamp: "2024-01-01T00:00:00.000Z",
      sessionId: "static-session-12345",
      deviceId: "static-device-67890",
      environment: "production",
      region: "cn-north-1"
    },
  },
};

// 记录第一次请求的时间
let firstRequestTime = null;
let isFirstRequest = true;

// 极致性能测试函数
export function peakTest() {
  runTest('peak');
}

// 通用测试函数 - 优化版本
function runTest(testType) {
  const baseUrl = 'http://localhost:${port}';
  const framework = '${framework}';
  
  // 根据测试类型调整端点权重
  const endpoints = getEndpointsByTestType(testType);
  
  // 随机选择一个端点进行测试
  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  const url = \`\${baseUrl}\${endpoint.path}\`;
  
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
      response = http.get(url, { headers });
    } else {
      response = http.post(url, JSON.stringify(endpoint.body), { 
        headers: { ...headers, 'Content-Type': 'application/json' }
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
      [\`\${endpoint.name} - 状态码是 200\`]: (r) => r.status === 200,
    });
    
    if (!success) {
      errorRate.add(1);
      console.error(\`❌ \${endpoint.name} 测试失败:\`, response.status);
    } else {
      errorRate.add(0);
      // 只在调试模式下输出成功信息
      if (__ENV.DEBUG) {
        console.log(\`✅ \${endpoint.name} 测试成功: \${responseTimeMs}ms\`);
      }
    }
    
  } catch (error) {
    errorRate.add(1);
    console.error(\`❌ \${endpoint.name} 请求异常:\`, error.message);
  }
  
  // 极致性能测试 - 无任何延迟
  // 移除所有 sleep() 调用
}

// 根据测试类型获取端点配置 - 优化版本
function getEndpointsByTestType(testType) {
  const baseEndpoints = [
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
      path: '/schema/validate', 
      method: 'POST', 
      name: 'Schema验证', 
      contentType: 'application/json',
      body: testData.schemaValidation, 
      weight: 1 
    },
  ];
  
  // 根据测试类型调整权重
  switch (testType) {
    case 'peak':
      return baseEndpoints.map(ep => ({ ...ep, weight: ep.weight * 0.25 }));
    default:
      return baseEndpoints;
  }
}

// 测试完成后的钩子 - 极致性能版本
export function handleSummary(data) {
  console.log('📊 极致性能测试完成，生成详细报告...');
  
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
      value: \`\${coldStart.toFixed(2)} ms\`,
      description: \`\${coldStart.toFixed(2)} ms. 无延迟，无妥协。冷启动王者之冠属于我们。\`
    },
    requestsPerSecond: {
      emoji: "⚡️",
      name: "每秒请求数",
      value: \`\${rps.toLocaleString()} rps\`,
      description: "为瞬时流量而生 — 无需预热。"
    },
    avgLatency: {
      emoji: "📉",
      name: "平均延迟",
      value: \`\${avgLatency.toFixed(2)} ms\`,
      description: "压力之下依然迅捷。始终如一。"
    },
    p95Latency: {
      emoji: "📊",
      name: "P95延迟",
      value: \`\${p95Latency.toFixed(2)} ms\`,
      description: "95%的请求延迟都在此范围内"
    },
    p99Latency: {
      emoji: "🎯",
      name: "P99延迟",
      value: \`\${p99Latency.toFixed(2)} ms\`,
      description: "99%的请求延迟都在此范围内"
    },
    errorRate: {
      emoji: "🚨",
      name: "错误率",
      value: \`\${(errorRateValue * 100).toFixed(3)}%\`,
      description: "请求失败率，越低越好"
    },
    totalRequests: {
      emoji: "🎯",
      name: "总请求数",
      value: \`\${totalReq.toLocaleString()} req / \${testDuration.toFixed(0)}s\`,
      description: \`在\${testDuration.toFixed(0)}秒内完成的总请求数\`
    }
  };
  
  // 生成控制台输出
  console.log('\\n🚀 极致性能测试结果 🚀');
  console.log('='.repeat(60));
  
  Object.entries(formattedResults).forEach(([key, result]) => {
    console.log(\`\${result.emoji} \${result.name}\`);
    console.log(\`   \${result.value}\`);
    console.log(\`   \${result.description}\`);
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
  
  // 获取当前时间戳，精确到秒
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:]/g, '-');
  
  // 返回JSON格式结果，文件名包含精确时间戳
  return {
    'k6-ultimate-results-' + timestamp + '.json': JSON.stringify(data, null, 2),
    'formatted-ultimate-results-' + timestamp + '.json': JSON.stringify(formattedResults, null, 2)
  };
}`;
}





// 运行单个框架测试
function runFrameworkTest(framework, config) {
  return new Promise((resolve, reject) => {
    logHeader(`${config.description} (端口: ${config.port})`);
    logPerformance(`开始极致性能测试`);
    
    // 生成 K6 测试配置
    const k6Config = generateK6Config(framework, config.port);
    const configPath = `./k6-test-${framework}.js`;
    fs.writeFileSync(configPath, k6Config);
    logInfo(`测试配置文件: ${configPath}`);
    
    // 设置环境变量
    const env = {
      ...process.env,
      BASE_URL: `http://localhost:${config.port}`,
      FRAMEWORK: framework.toUpperCase(),
      framework: framework
    };
    
    // 创建框架特定的结果目录
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const frameworkResultsDir = `./test-results/${framework}`;
    if (!fs.existsSync(frameworkResultsDir)) {
      fs.mkdirSync(frameworkResultsDir, { recursive: true });
    }
    
    // 运行 K6 测试
    const k6 = spawn('k6', [
      'run',
      '--out', `json=${frameworkResultsDir}/k6-${framework}-${timestamp}.json`,
      configPath
    ], {
      env,
      stdio: 'inherit'
    });
    
    k6.on('close', (code) => {
      if (code === 0) {
        logSuccess(`${framework} ${testType} 测试完成！`);
        // 清理临时配置文件
        try {
          fs.unlinkSync(configPath);
        } catch (e) {
          // 忽略删除错误
        }
        resolve();
      } else {
        logError(`${framework} 测试失败，退出码: ${code}`);
        reject(new Error(`测试失败，退出码: ${code}`));
      }
    });
    
    k6.on('error', (error) => {
      logError(`${framework} ${testType} 测试启动失败: ${error.message}`);
      reject(error);
    });
  });
}

// 运行所有框架测试
async function runAllTests() {
  try {
          logHeader(`开始 K6 极致性能测试`);
    
    // 检查 K6 是否安装
    try {
      await checkK6();
      logSuccess('K6 已安装');
    } catch (error) {
      logInfo('K6 未安装，正在安装...');
      await installK6();
    }
    
    // 创建测试结果目录
    const resultsDir = './test-results';
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
      logSuccess('创建测试结果目录');
    }
    
    // 显示测试配置
    logSubHeader(`极致性能测试配置`);
    logInfo('测试特点:', 'blue');
    log('  🚀 无预热阶段，直接峰值负载', 'green');
    log('  ⚡️ 无任何延迟，纯性能测试', 'green');
    log('  📊 高并发：500-2000 用户', 'green');
    log('  ⏱️  测试时长：2.5 分钟', 'green');
    
    // 运行每个框架的测试
    for (const [framework, config] of Object.entries(TEST_CONFIGS)) {
      try {
        await runFrameworkTest(framework, config);
        
        // 测试间隔
        if (framework !== Object.keys(TEST_CONFIGS).slice(-1)[0]) {
          logInfo('等待 10 秒后开始下一个测试...');
          await new Promise(resolve => setTimeout(resolve, 10000));
        }
      } catch (error) {
        logError(`${framework} 测试失败: ${error.message}`);
        // 继续下一个测试
      }
    }
    
    logHeader('所有测试完成！');
    logSuccess('测试结果已保存到 test-results 目录');
    
  } catch (error) {
    logError(`测试运行失败: ${error.message}`);
    process.exit(1);
  }
}

// 运行特定框架测试
async function runSpecificTest(framework) {
  if (!TEST_CONFIGS[framework]) {
    logError(`未知的框架: ${framework}`);
    logInfo('可用的框架:', 'blue');
    Object.keys(TEST_CONFIGS).forEach(f => log(`  - ${f}`, 'blue'));
    process.exit(1);
  }
  
  try {
    logHeader(`运行 ${framework} 框架极致性能测试`);
    
    // 检查 K6
    try {
      await checkK6();
    } catch (error) {
      await installK6();
    }
    
    // 创建测试结果目录
    const resultsDir = './test-results';
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    // 运行测试
    await runFrameworkTest(framework, TEST_CONFIGS[framework]);
    
    logHeader('测试完成！');
    
  } catch (error) {
    logError(`测试失败: ${error.message}`);
    process.exit(1);
  }
}

// 显示帮助信息
function showHelp() {
  logHeader('K6 极致性能测试运行器帮助');
  log('\n使用方法:', 'bright');
  log('  node run-k6-tests.js [框架名称]', 'cyan');
  log('\n参数:', 'bright');
  log('  框架名称    指定要测试的框架（可选）', 'cyan');
  log('             如果不指定，将测试所有框架', 'cyan');
  log('\n可用的框架:', 'bright');
  Object.entries(TEST_CONFIGS).forEach(([name, config]) => {
    log(`  ${name.padEnd(12)} ${config.description}`, 'cyan');
  });
  log('\n示例:', 'bright');
  log('  node run-k6-tests.js', 'cyan');
  log('  node run-k6-tests.js elysia', 'cyan');
  log('  node run-k6-tests.js vafast-mini', 'cyan');
  log('  node run-k6-tests.js express', 'cyan');
  log('\n特点:', 'bright');
  log('  🚀 完全集成，无需额外配置文件', 'green');
  log('  ⚡️ 极致性能测试，无任何延迟', 'green');
  log('  📊 自动生成测试配置', 'green');
  log('  🎯 保持命令行风格', 'green');
  log('  📁 结果按框架分类保存', 'green');
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }
  
  const framework = args[0] || null;
  
  if (framework) {
    // 运行特定框架测试
    await runSpecificTest(framework);
  } else {
    // 运行所有测试
    await runAllTests();
  }
}

// 运行脚本
main().catch(error => {
  logError(`程序执行失败: ${error.message}`);
  process.exit(1);
});

export {
  runFrameworkTest,
  runAllTests,
  TEST_CONFIGS
};
