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
  log(`  ${title}`, 'cyan');
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
    log(`${status} ${result.framework} - ${result.testType}: ${result.success ? '成功' : '失败'}`, color);
  });

  return report;
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
 * 等待指定时间
 * @param {number} ms - 等待毫秒数
 * @returns {Promise} Promise对象
 */
export function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
