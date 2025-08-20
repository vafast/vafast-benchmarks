#!/usr/bin/env node

// 简单的benchmark测试脚本
const BASE_URL = 'http://localhost:3000';

async function testEndpoint(method, path, body = null) {
  const start = performance.now();
  
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${BASE_URL}${path}`, options);
    const end = performance.now();
    const responseTime = end - start;
    
    if (response.ok) {
      const data = await response.json().catch(() => response.text());
      console.log(`✅ ${method} ${path} - ${responseTime.toFixed(2)}ms`);
      return { success: true, responseTime, data };
    } else {
      console.log(`❌ ${method} ${path} - ${response.status} ${response.statusText}`);
      return { success: false, responseTime, status: response.status };
    }
  } catch (error) {
    const end = performance.now();
    const responseTime = end - start;
    console.log(`💥 ${method} ${path} - Error: ${error.message} - ${responseTime.toFixed(2)}ms`);
    return { success: false, responseTime, error: error.message };
  }
}

async function runBenchmarks() {
  console.log('🚀 开始运行 Elysia Benchmarks 测试...\n');
  
  const results = [];
  
  // 基础接口测试
  console.log('=== 测试基础接口 ===');
  results.push(await testEndpoint('GET', '/'));
  results.push(await testEndpoint('GET', '/hello/world'));
  results.push(await testEndpoint('GET', '/json'));
  results.push(await testEndpoint('GET', '/api/users'));
  results.push(await testEndpoint('GET', '/api/users?search=alice'));
  
  // 验证schema接口测试
  console.log('\n=== 测试验证schema接口 ===');
  results.push(await testEndpoint('POST', '/api/users', {
    name: 'Test User',
    phone: '13800138000',
    age: 25
  }));
  
  results.push(await testEndpoint('GET', '/api/posts?page=1&limit=5'));
  
  // CPU密集型接口测试
  console.log('\n=== 测试CPU密集型接口 ===');
  results.push(await testEndpoint('GET', '/cpu/fibonacci/30'));
  results.push(await testEndpoint('GET', '/cpu/primes/1000'));
  
  // 中间件接口测试
  console.log('\n=== 测试中间件接口 ===');
  results.push(await testEndpoint('GET', '/middleware/timer'));
  results.push(await testEndpoint('POST', '/middleware/log', {
    level: 'info',
    message: 'Test log message'
  }));
  
  // 文件处理接口测试
  console.log('\n=== 测试文件处理接口 ===');
  results.push(await testEndpoint('POST', '/file/upload', {
    filename: 'test.txt',
    size: 1024,
    type: 'text/plain'
  }));
  
  // 数据库模拟接口测试
  console.log('\n=== 测试数据库模拟接口 ===');
  results.push(await testEndpoint('GET', '/db/query/users'));
  
  // 并发测试接口测试
  console.log('\n=== 测试并发测试接口 ===');
  results.push(await testEndpoint('GET', '/concurrency/test'));
  
  // 内存密集型接口测试
  console.log('\n=== 测试内存密集型接口 ===');
  results.push(await testEndpoint('GET', '/memory/test/100000'));
  
  // 错误处理接口测试
  console.log('\n=== 测试错误处理接口 ===');
  results.push(await testEndpoint('GET', '/error/test/validation'));
  results.push(await testEndpoint('GET', '/error/test/notfound'));
  
  // 缓存测试接口测试
  console.log('\n=== 测试缓存测试接口 ===');
  results.push(await testEndpoint('GET', '/cache/test/key1'));
  results.push(await testEndpoint('GET', '/cache/test/key2'));
  
  // 网络延迟接口测试
  console.log('\n=== 测试网络延迟接口 ===');
  results.push(await testEndpoint('GET', '/network/latency/100'));
  
  // 参数处理性能测试接口测试
  console.log('\n=== 测试参数处理性能测试接口 ===');
  results.push(await testEndpoint('POST', '/benchmark/parameter-parsing/users/123', {
    name: 'Test User',
    email: 'test@example.com',
    age: 25,
    active: true,
    tags: ['test', 'benchmark'],
    metadata: {
      created: '2024-01-01',
      updated: '2024-01-01',
      version: '1.0.0'
    },
    preferences: {
      theme: 'dark',
      language: 'zh-CN',
      notifications: true
    }
  }));
  
  results.push(await testEndpoint('GET', '/benchmark/query-processing?page=1&limit=10&sort=asc&filter=active&include=profile&exclude=password'));
  
  results.push(await testEndpoint('POST', '/benchmark/nested-data-processing', {
    user: {
      profile: {
        personal: {
          name: 'Complex User',
          age: 30,
          address: {
            street: 'Test Street',
            city: 'Test City',
            country: 'Test Country'
          }
        },
        preferences: {
          theme: 'light',
          language: 'en-US',
          notifications: [true, false, true]
        }
      },
      settings: {
        privacy: {
          publicProfile: false,
          shareData: true
        },
        security: {
          twoFactor: true,
          sessionTimeout: 3600
        }
      }
    },
    metadata: {
      version: '2.0.0',
      timestamp: '2024-01-01T00:00:00Z',
      tags: ['complex', 'nested', 'data']
    }
  }));
  

  
  // 统计结果
  console.log('\n=== 测试结果统计 ===');
  const successful = results.filter(r => r.success).length;
  const total = results.length;
  const avgResponseTime = results
    .filter(r => r.success)
    .reduce((sum, r) => sum + r.responseTime, 0) / successful;
  
  console.log(`总测试数: ${total}`);
  console.log(`成功: ${successful}`);
  console.log(`失败: ${total - successful}`);
  console.log(`成功率: ${((successful / total) * 100).toFixed(1)}%`);
  console.log(`平均响应时间: ${avgResponseTime.toFixed(2)}ms`);
  
  console.log('\n🎉 Benchmark测试完成!');
}

// 检查服务器是否运行
async function checkServer() {
  try {
    const response = await fetch(`${BASE_URL}/`);
    if (response.ok) {
      console.log('✅ 服务器正在运行');
      return true;
    }
  } catch (error) {
    console.log('❌ 无法连接到服务器，请确保服务器正在运行');
    console.log('运行命令: bun run dev');
    return false;
  }
}

// 主函数
async function main() {
  const serverRunning = await checkServer();
  if (serverRunning) {
    await runBenchmarks();
  }
}

main().catch(console.error);
