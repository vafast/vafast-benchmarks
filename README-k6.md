# K6 性能测试使用指南

## 概述

本项目使用 [Grafana k6](https://github.com/grafana/k6) 进行框架性能基准测试。k6 是一个现代化的负载测试工具，专门用于性能测试和基准测试。

## 安装 k6

### macOS (使用 Homebrew)
```bash
brew install k6
```

### Windows
```bash
choco install k6
```

### Linux
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

### 验证安装
```bash
k6 version
```

## 项目结构

```
vafast-benchmarks/
├── k6-test-config.js          # 完整 k6 测试配置
├── k6-quick-test.js           # 快速测试脚本
├── k6-benchmark-runner.ts     # 自动化测试运行器
├── test-results/              # 测试结果目录
└── frameworks/                # 各种框架实现
```

## 使用方法

### 1. 快速测试单个框架

首先启动一个框架服务器，然后运行 k6 测试：

```bash
# 启动 Elysia 框架 (端口 3000)
cd frameworks/elysia
bun run src/index.ts

# 在另一个终端运行 k6 测试
k6 run k6-quick-test.js --env BASE_URL=http://localhost:3000 --env FRAMEWORK=elysia
```

### 2. 完整基准测试

使用自动化测试运行器测试所有框架：

```bash
# 运行完整的基准测试
bun run benchmark:k6
```

### 3. 使用 npm 脚本

```bash
# 快速测试
npm run k6:quick

# 完整测试
npm run k6:full

# 自动化基准测试
npm run benchmark:k6
```

## 测试配置

### 快速测试配置 (k6-quick-test.js)
- **测试时长**: 30秒
- **用户数**: 1 → 10 个虚拟用户
- **阈值**: 95% 请求 < 1000ms，错误率 < 5%

### 完整测试配置 (k6-test-config.js)
- **测试时长**: 约 6 分钟
- **用户数**: 0 → 100 个虚拟用户
- **阶段**: 预热 → 爬升 → 稳定 → 峰值 → 下降
- **阈值**: 95% 请求 < 500ms，99% 请求 < 1000ms，错误率 < 1%

## 测试端点

k6 测试以下端点：

1. **JSON 序列化**: `GET /techempower/json`
2. **纯文本响应**: `GET /techempower/plaintext`
3. **数据库查询**: `GET /techempower/db?queries=1`
4. **Schema 验证**: `POST /schema/validate`

## 性能指标

k6 提供以下关键指标：

- **请求速率**: 每秒请求数 (req/s)
- **响应时间**: 平均、P95、P99 延迟
- **错误率**: 失败请求的百分比
- **吞吐量**: 总请求数和数据量
- **虚拟用户**: 并发用户数量

## 环境变量

可以通过环境变量配置测试：

```bash
# 设置基础 URL
export BASE_URL=http://localhost:3000

# 设置框架名称
export FRAMEWORK=elysia

# 运行测试
k6 run k6-test-config.js
```

## 输出格式

### 控制台输出
- 实时测试进度
- 详细的性能指标
- 错误和警告信息

### 文件输出
- JSON 格式的详细结果
- 可导入到 Grafana 等工具进行分析

## 自定义测试

### 修改测试配置
编辑 `k6-test-config.js` 中的 `options` 对象：

```javascript
export const options = {
  stages: [
    { duration: '1m', target: 50 },    // 1分钟内增加到50个用户
    { duration: '3m', target: 50 },    // 保持50个用户3分钟
    { duration: '1m', target: 0 },     // 1分钟内减少到0个用户
  ],
  thresholds: {
    http_req_duration: ['p(95)<300'],  // 95%请求在300ms内
    http_req_failed: ['rate<0.01'],    // 错误率小于1%
  },
};
```

### 添加新的测试端点
在测试函数中添加新的端点：

```javascript
const endpoints = [
  // ... 现有端点
  { path: '/api/health', method: 'GET', name: '健康检查' },
  { path: '/api/users', method: 'POST', name: '创建用户', body: userData },
];
```

## 故障排除

### 常见问题

1. **连接被拒绝**
   - 确保框架服务器正在运行
   - 检查端口号是否正确
   - 验证防火墙设置

2. **测试超时**
   - 增加超时设置
   - 检查网络连接
   - 验证服务器性能

3. **内存不足**
   - 减少虚拟用户数量
   - 缩短测试时长
   - 增加系统内存

### 调试模式

启用详细日志：

```bash
k6 run --verbose k6-test-config.js
```

## 集成 CI/CD

### GitHub Actions 示例

```yaml
name: K6 Performance Tests
on: [push, pull_request]

jobs:
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install k6
        run: |
          sudo gpg -k
          sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6
      - name: Run Performance Tests
        run: |
          # 启动服务器
          npm run start &
          sleep 10
          # 运行 k6 测试
          k6 run k6-quick-test.js
```

## 最佳实践

1. **预热阶段**: 总是包含预热阶段，让服务器达到稳定状态
2. **渐进式负载**: 使用阶段式负载增加，避免突然的流量冲击
3. **监控资源**: 同时监控 CPU、内存、网络等系统资源
4. **阈值设置**: 设置合理的性能阈值，确保测试有意义
5. **结果分析**: 定期分析测试结果，识别性能瓶颈

## 更多资源

- [k6 官方文档](https://k6.io/docs/)
- [k6 JavaScript API](https://k6.io/docs/javascript-api/)
- [性能测试最佳实践](https://k6.io/docs/testing-guides/)
- [Grafana 集成](https://k6.io/docs/results-visualization/grafana/)

## 支持

如果遇到问题，请：

1. 检查 k6 版本是否最新
2. 查看控制台错误信息
3. 参考 k6 官方文档
4. 在项目 Issues 中报告问题
