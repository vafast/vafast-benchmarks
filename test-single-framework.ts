import { UniversalFrameworkTester } from './universal-framework-tester';

async function testSingleFramework() {
  const tester = new UniversalFrameworkTester();
  
  try {
    console.log('🧪 测试单个框架...');
    
    // 测试 Hono 框架
    const result = await tester.testFramework('hono', 5);
    
    if (result) {
      console.log('✅ 测试成功:', result);
    } else {
      console.log('❌ 测试失败');
    }
    
  } catch (error) {
    console.error('❌ 测试执行失败:', error);
  } finally {
    console.log('🧹 清理资源...');
    await tester.stopAllServers();
    console.log('✅ 测试完成');
  }
}

// 运行测试
testSingleFramework();
