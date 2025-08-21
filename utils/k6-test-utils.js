/**
 * k6 测试工具函数
 * 包含测试运行、服务检查、报告生成等公共功能
 */

import { spawn } from 'child_process';
import fs from 'fs';

// 颜色输出配置
export const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

/**
 * 日志输出函数
 * @param {string} message - 消息内容
 * @param {string} color - 颜色名称
 */
export function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * 标题输出函数
 * @param {string} title - 标题内容
 */
export function logHeader(title) {
  log('\n' + '='.repeat(60), 'bright');
  log(`${title}`, 'cyan');
  log('='.repeat(60), 'bright');
}

/**
 * 子标题输出函数
 * @param {string} title - 子标题内容
 */
export function logSubHeader(title) {
  log('\n' + '-'.repeat(40), 'yellow');
  log(`  ${title}`, 'yellow');
  log('-'.repeat(40), 'yellow');
}

/**
 * 检查服务是否可用
 * @param {Object} framework - 框架配置对象
 * @returns {Promise<boolean>} 服务是否可用
 */
export async function checkService(framework) {
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

/**
 * 运行单个k6测试
 * @param {Object} framework - 框架配置对象
 * @param {string} testType - 测试类型
 * @returns {Promise<Object>} 测试结果
 */
export function runTest(framework, testType) {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      BASE_URL: framework.url,
      FRAMEWORK: framework.name,
      K6_OUT: `json=k6-results-${framework.name.toLowerCase()}-${testType}.json`
    };

    log(`🚀 开始 ${framework.name} 的 ${testType} 测试`, 'green');
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
        log(`✅ ${framework.name} ${testType} 测试完成`, 'green');
        resolve({ success: true, output, errorOutput });
      } else {
        log(`❌ ${framework.name} ${testType} 测试失败 (退出码: ${code})`, 'red');
        resolve({ success: false, output, errorOutput, code });
      }
    });

    k6Process.on('error', (error) => {
      log(`❌ ${framework.name} ${testType} 测试启动失败: ${error.message}`, 'red');
      reject(error);
    });
  });
}

/**
 * 生成测试报告
 * @param {Array} results - 测试结果数组
 * @returns {Object} 报告对象
 */
export function generateReport(results) {
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
    log(`${status} ${result.framework} - ${result.testType}: ${result.success ? '成功' : '失败'}`, color);
  });

  return report;
}

/**
 * 等待指定时间
 * @param {number} ms - 等待毫秒数
 * @returns {Promise} Promise对象
 */
export function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 检查k6是否已安装
 * @returns {Promise<boolean>} k6是否已安装
 */
export async function checkK6Installation() {
  try {
    const { spawnSync } = await import('child_process');
    const k6Version = spawnSync('k6', ['version'], { encoding: 'utf8' });
    log(`✅ k6 已安装: ${k6Version.stdout.trim()}`, 'green');
    return true;
  } catch (error) {
    log('❌ k6 未安装，请先安装 k6', 'red');
    log('安装命令: https://k6.io/docs/getting-started/installation/', 'blue');
    return false;
  }
}

/**
 * 验证测试类型参数
 * @param {Array} testTypes - 传入的测试类型数组
 * @param {Object} testConfigs - 测试配置对象
 * @returns {Object} 验证结果 {valid: boolean, validTypes: Array, message: string}
 */
export function validateTestTypes(testTypes, testConfigs) {
  if (testTypes.length === 0) {
    const message = '请选择要运行的测试类型:';
    const availableTypes = Object.keys(testConfigs).map(key => {
      const config = testConfigs[key];
      return `  ${key}: ${config.name} - ${config.description}`;
    }).join('\n');
    const example = '\n示例: node run-k6-tests.js peak quick';
    
    return {
      valid: false,
      validTypes: [],
      message: `${message}\n${availableTypes}${example}`
    };
  }

  const validTestTypes = testTypes.filter(type => testConfigs[type]);
  
  if (validTestTypes.length === 0) {
    return {
      valid: false,
      validTypes: [],
      message: '❌ 无效的测试类型'
    };
  }

  return {
    valid: true,
    validTypes: validTestTypes,
    message: `🎯 即将测试: ${validTestTypes.join(', ')}`
  };
}

/**
 * 检查框架服务状态
 * @param {Array} frameworks - 框架配置数组
 * @returns {Promise<Object>} 检查结果 {available: Array, unavailable: Array, message: string}
 */
export async function checkFrameworkServices(frameworks) {
  logSubHeader('检查框架服务状态');
  
  const available = [];
  const unavailable = [];
  
  for (const framework of frameworks) {
    const isAvailable = await checkService(framework);
    if (isAvailable) {
      log(`✅ ${framework.name} (端口 ${framework.port}) - 可用`, 'green');
      available.push(framework);
    } else {
      log(`❌ ${framework.name} (端口 ${framework.port}) - 不可用`, 'red');
      unavailable.push(framework);
    }
  }

  let message = '';
  if (available.length === 0) {
    message = '❌ 没有可用的框架服务\n请先启动框架服务: bun run start-servers';
  } else if (unavailable.length > 0) {
    message = `⚠️  ${unavailable.length} 个服务不可用，${available.length} 个服务可用`;
  } else {
    message = `✅ 所有 ${available.length} 个服务都可用`;
  }

  return {
    available,
    unavailable,
    message,
    allAvailable: available.length > 0
  };
}

/**
 * 显示系统检查摘要
 * @param {Object} k6Status - k6安装状态
 * @param {Object} testValidation - 测试类型验证结果
 * @param {Object} serviceStatus - 服务状态检查结果
 */
export function displaySystemCheckSummary(k6Status, testValidation, serviceStatus) {
  logHeader('🔍 系统检查摘要');
  
  // k6状态
  const k6Icon = k6Status ? '✅' : '❌';
  const k6Text = k6Status ? '已安装' : '未安装';
  log(`${k6Icon} k6 工具: ${k6Text}`, k6Status ? 'green' : 'red');
  
  // 测试类型
  if (testValidation.valid) {
    log(`✅ 测试类型: ${testValidation.validTypes.join(', ')}`, 'green');
  } else {
    log(`❌ 测试类型: 无效`, 'red');
  }
  
  // 服务状态
  const serviceIcon = serviceStatus.allAvailable ? '✅' : '⚠️';
  const serviceText = serviceStatus.allAvailable 
    ? `所有 ${serviceStatus.available.length} 个服务可用`
    : `${serviceStatus.available.length} 个可用，${serviceStatus.unavailable.length} 个不可用`;
  log(`${serviceIcon} 框架服务: ${serviceText}`, serviceStatus.allAvailable ? 'green' : 'yellow');
  
  log(''); // 空行
}

/**
 * 执行所有测试
 * @param {Array} testTypes - 要执行的测试类型数组
 * @param {Object} testConfigs - 测试配置对象
 * @param {Array} frameworks - 可用的框架数组
 * @returns {Promise<Array>} 所有测试结果
 */
export async function executeAllTests(testTypes, testConfigs, frameworks) {
  const allResults = [];
  
  for (const testType of testTypes) {
    logHeader(`🧪 运行 ${testConfigs[testType].name}`);
    
    for (const framework of frameworks) {
      const startTime = Date.now();
      const result = await runTest(framework, testType);
      
      allResults.push({
        framework: framework.name,
        testType,
        success: result.success,
        output: result.output,
        errorOutput: result.errorOutput
      });

      // 使用配置中的等待时间
      const waitTime = testConfigs[testType].waitTime || 1000;
      log(`⏳ 等待 ${waitTime/1000} 秒后继续下一个测试...`, 'blue');
      await wait(waitTime);
    }
  }
  
  return allResults;
}
