#!/usr/bin/env node

/**
 * k6 性能测试运行脚本
 * 基于 Grafana k6 官方最佳实践
 */

import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 测试配置
const testConfigs = {
  smoke: {
    name: '冒烟测试',
    description: '验证基本功能，快速发现问题',
    command: 'k6 run --out json=k6-results-smoke.json k6-test-config.js',
    duration: '15s'
  },
  average: {
    name: '平均负载测试',
    description: '模拟正常流量，测试系统稳定性',
    command: 'k6 run --out json=k6-results-average.json k6-test-config.js',
    duration: '50s'
  },
  stress: {
    name: '压力测试',
    description: '找到系统极限，测试高负载表现',
    command: 'k6 run --out json=k6-results-stress.json k6-test-config.js',
    duration: '90s'
  },
  peak: {
    name: '峰值测试',
    description: '测试最大容量，验证系统边界',
    command: 'k6 run --out json=k6-results-peak.json k6-test-config.js',
    duration: '70s'
  }
};

// 框架配置
const frameworks = [
  { name: 'Elysia', port: 3000, url: 'http://localhost:3000' },
  { name: 'Hono', port: 3001, url: 'http://localhost:3001' },
  { name: 'Express', port: 3002, url: 'http://localhost:3002' },
  { name: 'Koa', port: 3003, url: 'http://localhost:3003' },
  { name: 'Vafast', port: 3004, url: 'http://localhost:3004' },
  { name: 'Vafast-Mini', port: 3005, url: 'http://localhost:3005' }
];

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logHeader(title) {
  log('\n' + '='.repeat(60), 'bright');
  log(`  ${title}`, 'cyan');
  log('='.repeat(60), 'bright');
}

function logSubHeader(title) {
  log('\n' + '-'.repeat(40), 'yellow');
  log(`  ${title}`, 'yellow');
  log('-'.repeat(40), 'yellow');
}

// 检查服务是否可用
async function checkService(framework) {
  return new Promise((resolve) => {
    import('http').then(({ default: http }) => {
      const req = http.request(`${framework.url}/techempower/json`, { 
        method: 'GET',
        timeout: 3000 
      }, (res) => {
        if (res.statusCode === 200) {
          resolve(true);
        } else {
          resolve(false);
        }
      });
      
      req.on('error', () => {
        resolve(false);
      });
      
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
      
      req.end();
    }).catch(() => {
      resolve(false);
    });
  });
}

// 运行单个测试
function runTest(framework, testType) {
  return new Promise((resolve, reject) => {
    const config = testConfigs[testType];
    const env = {
      ...process.env,
      BASE_URL: framework.url,
      FRAMEWORK: framework.name,
      K6_OUT: `json=k6-results-${framework.name.toLowerCase()}-${testType}.json`
    };

    log(`🚀 开始 ${framework.name} 的 ${config.name}`, 'green');
    log(`   描述: ${config.description}`, 'blue');
    log(`   预计时长: ${config.duration}`, 'blue');
    log(`   目标URL: ${framework.url}`, 'blue');

    const k6Process = spawn('k6', ['run', 'k6-test-config.js'], {
      env,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    let errorOutput = '';

    k6Process.stdout.on('data', (data) => {
      const message = data.toString();
      output += message;
      
      // 显示更多k6输出信息
      if (message.includes('✅') || message.includes('❌') || 
          message.includes('running') || message.includes('complete') ||
          message.includes('http_req_duration') || message.includes('http_reqs') ||
          message.includes('iteration') || message.includes('vus')) {
        process.stdout.write(message);
      }
    });

    k6Process.stderr.on('data', (data) => {
      const message = data.toString();
      errorOutput += message;
      
      // 显示所有错误和警告信息
      process.stderr.write(message);
    });

    k6Process.on('close', (code) => {
      if (code === 0) {
        log(`✅ ${framework.name} ${config.name} 完成`, 'green');
        resolve({ success: true, output, errorOutput });
      } else {
        log(`❌ ${framework.name} ${config.name} 失败 (退出码: ${code})`, 'red');
        resolve({ success: false, output, errorOutput, code });
      }
    });

    k6Process.on('error', (error) => {
      log(`❌ ${framework.name} ${config.name} 启动失败: ${error.message}`, 'red');
      reject(error);
    });
  });
}

// 生成测试报告
function generateReport(results) {
  logHeader('📊 测试报告生成');
  
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalFrameworks: results.length,
      successfulTests: results.filter(r => r.success).length,
      failedTests: results.filter(r => !r.success).length
    },
    results: results.map(r => ({
      framework: r.framework,
      testType: r.testType,
      success: r.success,
      duration: r.duration,
      output: r.output
    }))
  };

  // 保存报告
  const reportPath = `test-report-${Date.now()}.json`;
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  log(`📄 测试报告已保存到: ${reportPath}`, 'green');

  // 显示摘要
  logSubHeader('测试摘要');
  log(`总框架数: ${report.summary.totalFrameworks}`, 'cyan');
  log(`成功测试: ${report.summary.successfulTests}`, 'green');
  log(`失败测试: ${report.summary.failedTests}`, 'red');

  // 显示详细结果
  logSubHeader('详细结果');
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    const color = result.success ? 'green' : 'red';
    log(`${status} ${result.framework.name} - ${result.testType}: ${result.success ? '成功' : '失败'}`, color);
  });
}

// 主函数
async function main() {
  logHeader('🚀 Vafast 框架性能测试套件');
  log('基于 Grafana k6 官方最佳实践', 'blue');
  
  // 检查k6是否安装
  try {
    const k6Version = spawnSync('k6', ['version'], { encoding: 'utf8' });
    log(`✅ k6 已安装: ${k6Version.stdout.trim()}`, 'green');
  } catch (error) {
    log('❌ k6 未安装，请先安装 k6', 'red');
    log('安装命令: https://k6.io/docs/getting-started/installation/', 'blue');
    process.exit(1);
  }

  // 选择测试类型
  const testTypes = process.argv.slice(2);
  if (testTypes.length === 0) {
    log('请选择要运行的测试类型:', 'yellow');
    Object.keys(testConfigs).forEach(key => {
      const config = testConfigs[key];
      log(`  ${key}: ${config.name} - ${config.description}`, 'blue');
    });
    log('\n示例: node run-k6-tests.js smoke average', 'cyan');
    process.exit(1);
  }

  // 验证测试类型
  const validTestTypes = testTypes.filter(type => testConfigs[type]);
  if (validTestTypes.length === 0) {
    log('❌ 无效的测试类型', 'red');
    process.exit(1);
  }

  log(`🎯 将运行以下测试: ${validTestTypes.join(', ')}`, 'green');

  // 检查框架服务状态
  logSubHeader('检查框架服务状态');
  const availableFrameworks = [];
  
  for (const framework of frameworks) {
    const isAvailable = await checkService(framework);
    if (isAvailable) {
      log(`✅ ${framework.name} (端口 ${framework.port}) - 可用`, 'green');
      availableFrameworks.push(framework);
    } else {
      log(`❌ ${framework.name} (端口 ${framework.port}) - 不可用`, 'red');
    }
  }

  if (availableFrameworks.length === 0) {
    log('❌ 没有可用的框架服务', 'red');
    log('请先启动框架服务: bun run start-servers', 'blue');
    process.exit(1);
  }

  // 运行测试
  const allResults = [];
  
  for (const testType of validTestTypes) {
    logHeader(`🧪 运行 ${testConfigs[testType].name}`);
    
    for (const framework of availableFrameworks) {
      const startTime = Date.now();
      const result = await runTest(framework, testType);
      const duration = Date.now() - startTime;
      
      allResults.push({
        framework: framework.name,
        testType,
        success: result.success,
        duration: `${duration}ms`,
        output: result.output,
        errorOutput: result.errorOutput
      });

      // 等待一下再运行下一个测试
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // 生成报告
  generateReport(allResults);
  
  logHeader('🎉 所有测试完成');
  log('感谢使用 Vafast 框架性能测试套件！', 'green');
}

// 错误处理
process.on('unhandledRejection', (reason, promise) => {
  log('❌ 未处理的Promise拒绝:', 'red');
  console.error(reason);
  process.exit(1);
});

// 运行主函数
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    log('❌ 程序执行失败:', 'red');
    console.error(error);
    process.exit(1);
  });
}

export { runTest, generateReport };
