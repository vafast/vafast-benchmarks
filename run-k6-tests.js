#!/usr/bin/env node

/**
 * k6 性能测试运行脚本
 * 基于 Grafana k6 官方最佳实践
 */

import { 
  log, 
  logHeader, 
  logSubHeader, 
  checkService, 
  runTest, 
  generateReport, 
  checkK6Installation, 
  wait 
} from './utils/k6-test-utils.js';

// 测试配置
const testConfigs = {
  peak: {
    name: '峰值测试',
    description: '测试框架最大性能，验证系统边界',
    command: 'k6 run --out json=k6-results-peak.json k6-test-config.js',
    duration: '50s'
  },
  quick: {
    name: '快速测试',
    description: '验证基本功能，快速发现问题',
    command: 'k6 run --out json=k6-results-quick.json k6-test-config.js',
    duration: '20s'
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

// 主函数
async function main() {
  logHeader('🚀 Vafast 框架性能测试套件');
  log('基于 Grafana k6 官方最佳实践', 'blue');
  
  // 检查k6是否安装
  const k6Installed = await checkK6Installation();
  if (!k6Installed) {
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
    log('\n示例: node run-k6-tests.js peak quick', 'cyan');
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
      await wait(1000);
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
if (process.argv[1] === new URL(import.meta.url).pathname) {
  main().catch(error => {
    log('❌ 程序执行失败:', 'red');
    console.error(error);
    process.exit(1);
  });
}

export { runTest, generateReport };
