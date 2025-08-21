#!/usr/bin/env node

/**
 * 分析测试结果并生成性能报告摘要
 */

import fs from 'fs';
import path from 'path';
import { format, toZonedTime } from 'date-fns-tz';

const RESULTS_DIR = './test-results';

async function analyzeResults() {
  console.log('🔍 分析测试结果...\n');
  
  // 收集所有结果文件
  const results = [];
  
  function collectResults(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        collectResults(fullPath);
      } else if (entry.name.endsWith('.json') && entry.name.includes('performance-report')) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          const data = JSON.parse(content);
          results.push({ file: fullPath, data });
        } catch (error) {
          console.warn(`⚠️ 无法解析文件 ${fullPath}: ${error.message}`);
        }
      }
    }
  }
  
  collectResults(RESULTS_DIR);
  
  console.log(`📊 找到 ${results.length} 个测试结果\n`);
  
  // 按框架和接口分组
  const groupedResults = {};
  
  for (const result of results) {
    const { framework, endpoint } = result.data;
    
    if (!groupedResults[framework]) {
      groupedResults[framework] = {};
    }
    
    if (!groupedResults[framework][endpoint]) {
      groupedResults[framework][endpoint] = [];
    }
    
    groupedResults[framework][endpoint].push(result);
  }
  
  // 为每个框架和接口选择最新的结果
  const latestResults = {};
  
  for (const framework in groupedResults) {
    latestResults[framework] = {};
    
    for (const endpoint in groupedResults[framework]) {
      // 选择最新的测试结果（按时间戳排序）
      const sortedResults = groupedResults[framework][endpoint].sort((a, b) => {
        return b.data.timestamp.localeCompare(a.data.timestamp);
      });
      
      latestResults[framework][endpoint] = sortedResults[0].data;
    }
  }
  
  // 生成性能报告
  console.log('## 🚀 Vafast 性能基准测试报告\n');
  
  const timeZone = 'Asia/Shanghai';
  const now = new Date();
  const beijingTime = toZonedTime(now, timeZone);
  const formattedTime = format(beijingTime, 'yyyy-MM-dd HH:mm:ss', { timeZone });
  
  console.log(`**测试时间**: ${formattedTime} (北京时间)\n`);
  console.log(`**测试配置**: 10秒极致性能测试，0-100用户线性增长\n`);
  
  // 按框架整理数据
  const frameworks = ['elysia', 'hono', 'express', 'koa', 'vafast', 'vafast-mini'];
  const interfaces = ['json', 'plaintext', 'db', 'updates', 'complex-json', 'batch-process', 'schema-validate'];
  
  // 生成接口性能对比表
  for (const interfaceName of interfaces) {
    console.log(`### 📊 ${getInterfaceDisplayName(interfaceName)} 接口性能对比\n`);
    
    const interfaceResults = [];
    
    for (const framework of frameworks) {
      if (latestResults[framework] && latestResults[framework][interfaceName]) {
        const result = latestResults[framework][interfaceName];
        interfaceResults.push({
          framework: framework,
          rps: result.summary.rps,
          avgLatency: result.summary.avgLatency,
          p95Latency: result.summary.p95Latency,
          p99Latency: result.summary.p99Latency,
          coldStart: result.summary.coldStart,
          errorRate: result.summary.errorRate,
          totalRequests: result.summary.totalRequests
        });
      }
    }
    
    if (interfaceResults.length === 0) {
      console.log('暂无测试数据\n');
      continue;
    }
    
    // 按RPS排序
    interfaceResults.sort((a, b) => b.rps - a.rps);
    
    // 生成表格
    console.log('| 排名 | 框架 | RPS | 平均延迟 | P95延迟 | P99延迟 | 冷启动 | 错误率 | 总请求数 |');
    console.log('|------|------|-----|----------|---------|---------|--------|--------|----------|');
    
    interfaceResults.forEach((result, index) => {
      const rank = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : (index + 1).toString();
      console.log(`| ${rank} | **${result.framework}** | ${formatNumber(result.rps)} | ${result.avgLatency.toFixed(2)}ms | ${result.p95Latency.toFixed(2)}ms | ${result.p99Latency.toFixed(2)}ms | ${result.coldStart.toFixed(2)}ms | ${(result.errorRate * 100).toFixed(3)}% | ${formatNumber(result.totalRequests)} |`);
    });
    
    console.log('\n');
  }
  
  // 生成框架综合性能排名
  console.log('### 🏆 框架综合性能排名\n');
  
  const frameworkSummary = [];
  
  for (const framework of frameworks) {
    if (!latestResults[framework]) continue;
    
    const interfaces = Object.keys(latestResults[framework]);
    if (interfaces.length === 0) continue;
    
    let totalRps = 0;
    let totalLatency = 0;
    let totalColdStart = 0;
    let totalErrorRate = 0;
    let totalRequests = 0;
    let count = 0;
    
    for (const interfaceName of interfaces) {
      const result = latestResults[framework][interfaceName];
      totalRps += result.summary.rps;
      totalLatency += result.summary.avgLatency;
      totalColdStart += result.summary.coldStart;
      totalErrorRate += result.summary.errorRate;
      totalRequests += result.summary.totalRequests;
      count++;
    }
    
    frameworkSummary.push({
      framework: framework,
      avgRps: totalRps / count,
      avgLatency: totalLatency / count,
      avgColdStart: totalColdStart / count,
      avgErrorRate: totalErrorRate / count,
      totalRequests: totalRequests,
      interfaceCount: count
    });
  }
  
  // 按平均RPS排序
  frameworkSummary.sort((a, b) => b.avgRps - a.avgRps);
  
  console.log('| 排名 | 框架 | 平均RPS | 平均延迟 | 平均冷启动 | 平均错误率 | 总请求数 | 测试接口数 |');
  console.log('|------|------|---------|----------|------------|------------|----------|------------|');
  
  frameworkSummary.forEach((summary, index) => {
    const rank = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : (index + 1).toString();
    console.log(`| ${rank} | **${summary.framework}** | ${formatNumber(summary.avgRps)} | ${summary.avgLatency.toFixed(2)}ms | ${summary.avgColdStart.toFixed(2)}ms | ${(summary.avgErrorRate * 100).toFixed(3)}% | ${formatNumber(summary.totalRequests)} | ${summary.interfaceCount}/7 |`);
  });
  
  console.log('\n');
  
  // 生成性能亮点
  console.log('### ⚡️ 性能亮点\n');
  
  // 找到最高RPS
  let maxRps = 0;
  let maxRpsFramework = '';
  let maxRpsInterface = '';
  
  // 找到最低延迟
  let minLatency = Infinity;
  let minLatencyFramework = '';
  let minLatencyInterface = '';
  
  // 找到最快冷启动
  let minColdStart = Infinity;
  let minColdStartFramework = '';
  let minColdStartInterface = '';
  
  for (const framework in latestResults) {
    for (const interfaceName in latestResults[framework]) {
      const result = latestResults[framework][interfaceName];
      
      if (result.summary.rps > maxRps) {
        maxRps = result.summary.rps;
        maxRpsFramework = framework;
        maxRpsInterface = interfaceName;
      }
      
      if (result.summary.avgLatency < minLatency) {
        minLatency = result.summary.avgLatency;
        minLatencyFramework = framework;
        minLatencyInterface = interfaceName;
      }
      
      if (result.summary.coldStart < minColdStart) {
        minColdStart = result.summary.coldStart;
        minColdStartFramework = framework;
        minColdStartInterface = interfaceName;
      }
    }
  }
  
  console.log(`- 🏆 **最高RPS**: ${maxRpsFramework} 框架的 ${getInterfaceDisplayName(maxRpsInterface)} 接口达到 **${formatNumber(maxRps)} RPS**`);
  console.log(`- ⚡️ **最低延迟**: ${minLatencyFramework} 框架的 ${getInterfaceDisplayName(minLatencyInterface)} 接口延迟仅 **${minLatency.toFixed(2)}ms**`);
  console.log(`- 🚀 **最快冷启动**: ${minColdStartFramework} 框架的 ${getInterfaceDisplayName(minColdStartInterface)} 接口冷启动仅 **${minColdStart.toFixed(2)}ms**`);
  
  console.log('\n### 📈 测试统计\n');
  console.log(`- 📊 **已完成测试**: ${results.length} 个`);
  console.log(`- 🎯 **测试框架**: ${Object.keys(latestResults).length} 个`);
  console.log(`- 🔧 **测试接口**: 7 种类型`);
  console.log(`- 📁 **结果目录**: \`./test-results/\``);
  
  console.log('\n---\n');
  console.log(`*报告生成时间: ${formattedTime}*`);
}

function getInterfaceDisplayName(interfaceName) {
  const names = {
    'json': 'JSON序列化',
    'plaintext': '纯文本响应',
    'db': '数据库查询', 
    'updates': '数据库更新',
    'complex-json': '复杂JSON序列化',
    'batch-process': '批量数据处理',
    'schema-validate': 'Schema验证'
  };
  return names[interfaceName] || interfaceName;
}

function formatNumber(num) {
  return Math.round(num).toLocaleString();
}

// 运行分析
analyzeResults().catch(console.error);