import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// 自定义指标
const errorRate = new Rate('errors');

// 测试配置
export const options = {
  stages: [
    { duration: '30s', target: 20 }, // 预热阶段
    { duration: '1m', target: 100 }, // 正常负载
    { duration: '30s', target: 200 }, // 峰值负载
    { duration: '1m', target: 100 }, // 回到正常负载
    { duration: '30s', target: 0 }, // 逐渐减少
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95%的请求在500ms内完成
    http_req_failed: ['rate<0.1'], // 错误率小于10%
    errors: ['rate<0.1'],
  },
};

// 基础URL
const BASE_URL = 'http://localhost:3000';

// 随机数据生成器
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// 测试场景
export default function () {
  const testType = randomChoice(['json', 'plaintext', 'db', 'updates', 'complex', 'batch']);
  
  let response;
  let success = false;

  switch (testType) {
    case 'json':
      response = http.get(`${BASE_URL}/techempower/json`);
      success = check(response, {
        'JSON status is 200': (r) => r.status === 200,
        'JSON has correct content': (r) => r.body.includes('Hello, World!'),
        'JSON content type': (r) => r.headers['Content-Type']?.includes('application/json'),
      });
      break;

    case 'plaintext':
      response = http.get(`${BASE_URL}/techempower/plaintext`);
      success = check(response, {
        'Plaintext status is 200': (r) => r.status === 200,
        'Plaintext has correct content': (r) => r.body === 'Hello, World!',
      });
      break;

    case 'db':
      const queries = randomInt(1, 20);
      response = http.get(`${BASE_URL}/techempower/db?queries=${queries}`);
      success = check(response, {
        'DB status is 200': (r) => r.status === 200,
        'DB returns array': (r) => r.json().length === queries,
        'DB has correct structure': (r) => {
          const data = r.json();
          return data.every(item => item.id && item.randomNumber);
        },
      });
      break;

    case 'updates':
      const updateQueries = randomInt(1, 20);
      response = http.get(`${BASE_URL}/techempower/updates?queries=${updateQueries}`);
      success = check(response, {
        'Updates status is 200': (r) => r.status === 200,
        'Updates returns array': (r) => r.json().length === updateQueries,
      });
      break;

    case 'complex':
      const depth = randomInt(1, 5);
      response = http.get(`${BASE_URL}/techempower/complex-json?depth=${depth}`);
      success = check(response, {
        'Complex JSON status is 200': (r) => r.status === 200,
        'Complex JSON has correct structure': (r) => {
          const data = r.json();
          return data.level === depth;
        },
      });
      break;

    case 'batch':
      const itemCount = randomInt(10, 50);
      const operation = randomChoice(['sum', 'average', 'count']);
      const items = Array.from({ length: itemCount }, (_, i) => ({
        id: i + 1,
        value: randomInt(1, 1000),
        name: `Item ${i + 1}`
      }));
      
      response = http.post(`${BASE_URL}/techempower/batch-process`, JSON.stringify({
        items,
        operation
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
      
      success = check(response, {
        'Batch process status is 200': (r) => r.status === 200,
        'Batch process returns correct data': (r) => {
          const data = r.json();
          return data.operation === operation && data.totalItems === itemCount;
        },
      });
      break;
  }

  // 记录错误
  if (!success) {
    errorRate.add(1);
  }

  // 随机延迟，模拟真实用户行为
  sleep(randomInt(1, 3));
}

// 测试完成后的钩子
export function teardown(data) {
  console.log('Test completed!');
  console.log('Final error rate:', errorRate.value);
}
