#!/usr/bin/env node

/**
 * K6 完全集成测试脚本
 * 支持测试框架和指定接口的极限性能
 * 命令行用法：
 *   node run-k6-tests.js <框架名> [接口名]
 *   node run-k6-tests.js elysia                    # 测试elysia框架所有接口
 *   node run-k6-tests.js elysia json              # 只测试elysia框架的JSON接口
 * 所有测试配置和逻辑都集成在一个文件中
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { format, toZonedTime } from 'date-fns-tz';

// 测试配置 - 所有框架统一使用3000端口，依次启动测试
const TEST_CONFIGS = {
  'vafast-mini': {
    port: 3000,
    directory: 'frameworks/vafast-mini',
    startCommand: ['bun', 'run', 'src/index.ts'],
    description: 'Vafast Mini 框架测试'
  },
  'vafast': {
    port: 3000,
    directory: 'frameworks/vafast',
    startCommand: ['bun', 'run', 'src/index.ts'],
    description: 'Vafast 框架测试'
  },
  'express': {
    port: 3000,
    directory: 'frameworks/express',
    startCommand: ['bun', 'run', 'src/index.ts'],
    description: 'Express 框架测试'
  },
  'koa': {
    port: 3000,
    directory: 'frameworks/koa',
    startCommand: ['bun', 'run', 'src/index.ts'],
    description: 'Koa 框架测试'
  },
  'hono': {
    port: 3000,
    directory: 'frameworks/hono',
    startCommand: ['bun', 'run', 'src/index.ts'],
    description: 'Hono 框架测试'
  },
  'elysia': {
    port: 3000,
    directory: 'frameworks/elysia',
    startCommand: ['bun', 'run', 'src/index.ts'],
    description: 'Elysia 框架测试'
  },
  'gin': {
    port: 3000,
    directory: 'frameworks/gin',
    startCommand: ['./run.sh'],
    description: 'Golang Gin 框架测试'
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

// 将当前时间格式化为北京时间标准格式：YYYY-MM-DD HH:mm:ss+08:00
function formatBeijingNow() {
  const timeZone = 'Asia/Shanghai';
  const now = new Date();
  const beijingTime = toZonedTime(now, timeZone);
  return format(beijingTime, 'yyyy-MM-dd HH:mm:ssXXX', { timeZone });
}

// 用于文件名的安全时间戳：YYYY-MM-DD_HH-mm-ss
function formatBeijingForFilename() {
  const timeZone = 'Asia/Shanghai';
  const now = new Date();
  const beijingTime = toZonedTime(now, timeZone);
  return format(beijingTime, 'yyyy-MM-dd_HH-mm-ss', { timeZone });
}

// 启动框架服务器
function startFrameworkServer(framework, config) {
  return new Promise((resolve, reject) => {
    logStep(`启动 ${config.description}...`);
    
    const server = spawn(config.startCommand[0], config.startCommand.slice(1), {
      cwd: config.directory,
      stdio: 'pipe',
    });
    
    let output = '';
    let started = false;
    
    server.stdout?.on('data', (data) => {
      output += data.toString();
      // 检查多种可能的启动成功标识
      if (
        !started &&
        (output.includes('Server running') ||
          output.includes('listening') ||
          output.includes('running at') ||
          output.includes('🚀') ||
          output.includes('Server started') ||
          output.includes('Ready'))
      ) {
        started = true;
        logSuccess(`${config.description} 启动成功 (端口: ${config.port})`);
        resolve(server);
      }
    });
    
    server.stderr?.on('data', (data) => {
      output += data.toString();
    });
    
    server.on('error', (error) => {
      logError(`${config.description} 启动失败: ${error.message}`);
      reject(error);
    });
    
    // 20秒超时
    setTimeout(() => {
      if (!started) {
        logWarning(`${config.description} 启动超时 (20秒)`);
        server.kill();
        reject(new Error(`${config.description} 启动超时`));
      }
    }, 20000);
  });
}

// 停止服务器
function stopServer(server, frameworkName) {
  return new Promise((resolve) => {
    if (!server || server.killed) {
      resolve();
      return;
    }
    
    logStep(`停止 ${frameworkName} 服务器...`);
    
    server.on('close', () => {
      logSuccess(`${frameworkName} 服务器已停止`);
      resolve();
    });
    
    // 发送SIGTERM信号
    server.kill('SIGTERM');
    
    // 如果5秒后还没停止，强制kill
    setTimeout(() => {
      if (!server.killed) {
        server.kill('SIGKILL');
        logWarning(`${frameworkName} 服务器被强制停止`);
        resolve();
      }
    }, 5000);
  });
}

// 检查端口是否可用
function waitForPort(port, maxRetries = 10) {
  return new Promise((resolve, reject) => {
    let retries = 0;
    
    const checkPort = () => {
      const check = spawn('curl', ['-s', `http://localhost:${port}/health`], { stdio: 'pipe' });
      
      check.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          retries++;
          if (retries >= maxRetries) {
            reject(new Error(`端口 ${port} 检查超时`));
          } else {
            setTimeout(checkPort, 1000); // 等待1秒后重试
          }
        }
      });
      
      check.on('error', () => {
        retries++;
        if (retries >= maxRetries) {
          reject(new Error(`端口 ${port} 检查失败`));
        } else {
          setTimeout(checkPort, 1000);
        }
      });
    };
    
    checkPort();
  });
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

// 定义所有可用的接口
const AVAILABLE_ENDPOINTS = {
  'json': {
    path: '/techempower/json',
    method: 'GET',
    name: 'JSON序列化',
    contentType: 'application/json',
    weight: 1
  },
  'plaintext': {
    path: '/techempower/plaintext',
    method: 'GET',
    name: '纯文本响应',
    contentType: 'text/plain',
    weight: 1
  },
  'db': {
    path: '/techempower/db',
    method: 'GET',
    name: '数据库查询',
    contentType: 'application/json',
    qs: { queries: 1 },
    weight: 1
  },
  'updates': {
    path: '/techempower/updates',
    method: 'GET',
    name: '数据库更新',
    contentType: 'application/json',
    qs: { queries: 1 },
    weight: 1
  },
  'complex-json': {
    path: '/techempower/complex-json',
    method: 'GET',
    name: '复杂JSON序列化',
    contentType: 'application/json',
    qs: { depth: 5 },
    weight: 1
  },
  'batch-process': {
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
  'schema-validate': {
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
  }
};

// 复制并自定义K6配置模板文件
function prepareK6ConfigFile(framework, port, specificEndpoint = null) {
  const templatePath = './k6-config-template.js';
  const configPath = `./k6-test-${framework}${specificEndpoint ? '-' + specificEndpoint : ''}.js`;
  
  try {
    // 读取模板文件
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    
    // 预先计算时间戳（使用date-fns）
    const timestamp = formatBeijingForFilename();
    const currentTime = formatBeijingNow();
    
    // 使用字符串替换来自定义配置（避免复杂的模板引擎）
    let customizedContent = templateContent
      .replace(/\$\{port\}/g, port)
      .replace(/\$\{framework\}/g, framework)
      .replace(/\$\{specificEndpoint\}/g, specificEndpoint || '')
      .replace(/\$\{timestamp\}/g, timestamp)
      .replace(/\$\{currentTime\}/g, currentTime);
    
    // 写入自定义配置文件
    fs.writeFileSync(configPath, customizedContent);
    
    return configPath;
  } catch (error) {
    throw new Error(`创建K6配置文件失败: ${error.message}`);
  }
}





// 运行单个框架测试（包含启动和停止服务器）
function runFrameworkTest(framework, config, specificEndpoint = null) {
  return new Promise(async (resolve, reject) => {
    let server = null;
    
    try {
      const testDescription = specificEndpoint 
        ? `${config.description} - ${getEndpointDisplayName(specificEndpoint)} 接口测试`
        : `${config.description} - 所有接口测试`;
      
      logHeader(`${testDescription} (端口: ${config.port})`);
      logPerformance(`开始冷启动性能测试`);
      
      // 1. 启动服务器（测试真正的冷启动）
      server = await startFrameworkServer(framework, config);
      
      // 2. 等待服务器完全启动
      await waitForPort(config.port);
      logSuccess(`${framework} 服务器就绪，开始性能测试`);
      
      // 3. 准备 K6 测试配置文件
      const configPath = prepareK6ConfigFile(framework, config.port, specificEndpoint);
      logInfo(`测试配置文件: ${configPath}`);
      
      // 4. 设置环境变量
      const env = {
        ...process.env,
        FRAMEWORK: framework,
        PORT: config.port.toString(),
        TARGET_ENDPOINT: specificEndpoint || ''
      };
      
      // 5. 创建框架和接口特定的结果目录
      const endpointName = specificEndpoint || 'all-endpoints';
      const frameworkResultsDir = `./test-results/${framework}`;
      const endpointResultsDir = `./test-results/${framework}/${endpointName}`;
      
      if (!fs.existsSync(frameworkResultsDir)) {
        fs.mkdirSync(frameworkResultsDir, { recursive: true });
      }
      
      if (!fs.existsSync(endpointResultsDir)) {
        fs.mkdirSync(endpointResultsDir, { recursive: true });
        logSuccess(`创建接口测试目录: ${endpointResultsDir}`);
      }
      
      // 6. 运行 K6 测试
      const k6 = spawn('k6', [
        'run',
        configPath
      ], {
        env,
        stdio: 'inherit'
      });
      
      k6.on('close', async (code) => {
        // 7. 停止服务器
        await stopServer(server, framework);
        
        // 8. 清理临时配置文件
        try {
          fs.unlinkSync(configPath);
        } catch (e) {
          // 忽略删除错误
        }
        
        if (code === 0) {
          const testType = specificEndpoint ? `${specificEndpoint} 接口` : '所有接口';
          logSuccess(`${framework} ${testType}测试完成！`);
          resolve();
        } else {
          logError(`${framework} 测试失败，退出码: ${code}`);
          reject(new Error(`测试失败，退出码: ${code}`));
        }
      });
      
      k6.on('error', async (error) => {
        // 出错时也要停止服务器
        await stopServer(server, framework);
        logError(`${framework} 测试启动失败: ${error.message}`);
        reject(error);
      });
      
    } catch (error) {
      // 启动失败时停止服务器
      if (server) {
        await stopServer(server, framework);
      }
      logError(`${framework} 启动失败: ${error.message}`);
      reject(error);
    }
  });
}

// 辅助函数：验证接口是否有效
function isValidEndpoint(endpoint) {
  return Object.keys(AVAILABLE_ENDPOINTS).includes(endpoint) ||
         Object.values(AVAILABLE_ENDPOINTS).some(ep => {
           const endpointId = ep.path.split('/').pop();
           const endpointKey = endpointId.replace('-', '');
           return endpointId === endpoint || endpointKey === endpoint || ep.name === endpoint;
         });
}

// 辅助函数：获取接口显示名称
function getEndpointDisplayName(endpoint) {
  if (AVAILABLE_ENDPOINTS[endpoint]) {
    return AVAILABLE_ENDPOINTS[endpoint].name;
  }
  
  // 尝试精确匹配
  for (const [key, ep] of Object.entries(AVAILABLE_ENDPOINTS)) {
    const endpointId = ep.path.split('/').pop();
    const endpointKey = endpointId.replace('-', '');
    if (endpointId === endpoint || endpointKey === endpoint || ep.name === endpoint) {
      return ep.name;
    }
  }
  
  return endpoint; // 如果找不到，返回原始名称
}

// 辅助函数：规范化接口名称
function normalizeEndpointName(endpoint) {
  if (AVAILABLE_ENDPOINTS[endpoint]) {
    return endpoint;
  }
  
  // 尝试精确匹配
  for (const [key, ep] of Object.entries(AVAILABLE_ENDPOINTS)) {
    const endpointId = ep.path.split('/').pop();
    const endpointKey = endpointId.replace('-', '');
    if (endpointId === endpoint || endpointKey === endpoint || ep.name === endpoint) {
      return key;
    }
  }
  
  return null; // 如果找不到，返回null
}

// 运行特定框架和接口测试
async function runSpecificTest(framework, endpoint = null) {
  if (!TEST_CONFIGS[framework]) {
    logError(`未知的框架: ${framework}`);
    logInfo('可用的框架:', 'blue');
    Object.keys(TEST_CONFIGS).forEach(f => log(`  - ${f}`, 'blue'));
    process.exit(1);
  }
  
  // 验证接口名称（如果提供了）
  if (endpoint && !isValidEndpoint(endpoint)) {
    logError(`未知的接口: ${endpoint}`);
    logInfo('可用的接口:', 'blue');
    Object.entries(AVAILABLE_ENDPOINTS).forEach(([key, ep]) => {
      log(`  - ${key.padEnd(15)} ${ep.name} (${ep.method} ${ep.path})`, 'blue');
    });
    process.exit(1);
  }
  
  try {
    const testDescription = endpoint 
      ? `${framework} 框架 ${getEndpointDisplayName(endpoint)} 接口极致性能测试`
      : `${framework} 框架所有接口极致性能测试`;
    
    logHeader(testDescription);
    
    // 检查 K6
    try {
      await checkK6();
    } catch (error) {
      await installK6();
    }
    
    // 创建测试结果目录结构
    const resultsDir = './test-results';
    const frameworkDir = path.join(resultsDir, framework);
    const endpointDir = path.join(frameworkDir, endpoint || 'all-endpoints');
    
    [resultsDir, frameworkDir, endpointDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logSuccess(`创建目录: ${dir}`);
      }
    });
    
    // 运行测试
    await runFrameworkTest(framework, TEST_CONFIGS[framework], endpoint);
    
    logHeader('测试完成！');
    const reportPath = path.join(endpointDir, `performance-report-${formatBeijingForFilename()}.json`);
    logSuccess(`测试报告保存至: ${reportPath}`);
    
  } catch (error) {
    logError(`测试失败: ${error.message}`);
    process.exit(1);
  }
}

// 显示帮助信息
function showHelp() {
  logHeader('K6 极致性能测试运行器帮助');
  log('\n使用方法:', 'bright');
  log('  node run-k6-tests.js <框架名称> <接口名称>', 'cyan');
  log('\n参数说明:', 'bright');
  log('  框架名称    指定要测试的框架（必须）', 'cyan');
  log('  接口名称    指定要测试的接口（必须）', 'cyan');
  log('\n可用的框架:', 'bright');
  Object.entries(TEST_CONFIGS).forEach(([name, config]) => {
    log(`  ${name.padEnd(12)} ${config.description}`, 'cyan');
  });
  log('\n可用的接口:', 'bright');
  Object.entries(AVAILABLE_ENDPOINTS).forEach(([key, endpoint]) => {
    log(`  ${key.padEnd(15)} ${endpoint.name.padEnd(12)} (${endpoint.method} ${endpoint.path})`, 'cyan');
  });
  log('\n使用示例:', 'bright');
  log('  node run-k6-tests.js elysia json', 'green');
  log('    # 测试 Elysia 框架的 JSON 序列化接口', 'gray');
  log('  node run-k6-tests.js express db', 'green');
  log('    # 测试 Express 框架的数据库查询接口', 'gray');
  log('  node run-k6-tests.js hono plaintext', 'green');
  log('    # 测试 Hono 框架的纯文本响应接口', 'gray');
  log('\n报告结构:', 'bright');
  log('  test-results/', 'cyan');
  log('  └── <框架名>/', 'cyan');
  log('      └── <接口名>/', 'cyan');
  log('          └── performance-report-YYYY-MM-DD_HH-mm-ss.json', 'cyan');
  log('\n特点:', 'bright');
  log('  🎯 精确测试：一次只测试一个框架的一个接口', 'green');
  log('  📁 分类存储：按框架和接口分层存储测试报告', 'green');
  log('  ⏰ 时间追踪：报告文件名包含精确到秒的时间戳', 'green');
  log('  📊 完整指标：冷启动、RPS、延迟、成功率等详细数据', 'green');
  log('  🛠  简单易用：命令行参数直观，易于自动化', 'green');
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }
  
  // 必须提供两个参数：框架名和接口名
  if (args.length !== 2) {
    logError('必须提供两个参数：框架名和接口名');
    logInfo('正确用法: node run-k6-tests.js <框架名> <接口名>');
    logInfo('查看帮助: node run-k6-tests.js --help');
    process.exit(1);
  }
  
  const framework = args[0];
  const endpoint = args[1];
  
  // 规范化接口名称
  const normalizedEndpoint = normalizeEndpointName(endpoint);
  
  if (!normalizedEndpoint) {
    logError(`未知的接口: ${endpoint}`);
    logInfo('可用的接口:');
    Object.entries(AVAILABLE_ENDPOINTS).forEach(([key, ep]) => {
      log(`  - ${key.padEnd(15)} ${ep.name} (${ep.method} ${ep.path})`, 'blue');
    });
    process.exit(1);
  }
  
  // 运行特定框架和接口的测试
  await runSpecificTest(framework, normalizedEndpoint);
}

// 运行脚本
main().catch(error => {
  logError(`程序执行失败: ${error.message}`);
  process.exit(1);
});

export {
  runFrameworkTest,
  TEST_CONFIGS
};
