import http from 'k6/http';
import { check, sleep } from 'k6';

// 测试配置
export const options = {
  vus: 10, // 虚拟用户数
  duration: '30s', // 测试持续时间
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95%的请求在500ms内完成
    http_req_failed: ['rate<0.1'], // 错误率小于10%
  },
};

// 基础URL
const BASE_URL = 'http://localhost:3000';

export default function () {
  // 测试JSON接口
  const jsonResponse = http.get(`${BASE_URL}/techempower/json`);
  check(jsonResponse, {
    'JSON status is 200': (r) => r.status === 200,
    'JSON has correct content': (r) => r.body.includes('Hello, World!'),
  });

  // 测试纯文本接口
  const plaintextResponse = http.get(`${BASE_URL}/techempower/plaintext`);
  check(plaintextResponse, {
    'Plaintext status is 200': (r) => r.status === 200,
    'Plaintext has correct content': (r) => r.body === 'Hello, World!',
  });

  // 测试数据库查询接口
  const dbResponse = http.get(`${BASE_URL}/techempower/db?queries=5`);
  check(dbResponse, {
    'DB status is 200': (r) => r.status === 200,
    'DB returns 5 items': (r) => r.json().length === 5,
  });

  // 测试复杂JSON接口
  const complexResponse = http.get(`${BASE_URL}/techempower/complex-json?depth=3`);
  check(complexResponse, {
    'Complex JSON status is 200': (r) => r.status === 200,
    'Complex JSON has correct structure': (r) => r.json().level === 3,
  });

  // 随机延迟
  sleep(1);
}
