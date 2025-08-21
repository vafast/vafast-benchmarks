#!/usr/bin/env node

/**
 * k6 性能测试运行脚本
 * 基于 Grafana k6 官方最佳实践
 */

import { 
  log, 
  logHeader, 
  logSubHeader, 
  runTest, 
  generateReport, 
  checkK6Installation, 
  validateTestTypes,
  checkFrameworkServices,
  displaySystemCheckSummary,
  executeAllTests,
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
  
  // 获取测试类型参数
  const testTypes = process.argv.slice(2);
  
  // 系统检查
  const k6Status = await checkK6Installation();
  if (!k6Status) {
    process.exit(1);
  }
  
  const testValidation = validateTestTypes(testTypes, testConfigs);
  if (!testValidation.valid) {
    log(testValidation.message, 'yellow');
    process.exit(1);
  }
  
  const serviceStatus = await checkFrameworkServices(frameworks);
  if (!serviceStatus.allAvailable) {
    log(serviceStatus.message, 'red');
    process.exit(1);
  }
  
  // 显示系统检查摘要
  displaySystemCheckSummary(k6Status, testValidation, serviceStatus);
  
  // // 执行所有测试
  // const allResults = await executeAllTests(
  //   testValidation.validTypes, 
  //   testConfigs, 
  //   serviceStatus.available
  // );

  // // 生成报告
  // generateReport(allResults);
  
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
