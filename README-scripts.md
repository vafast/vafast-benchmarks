# 脚本使用说明

## 🚀 服务器管理脚本

### 启动所有服务器
```bash
bun run start:servers
```

这个脚本会：
- 启动所有框架服务器（Elysia, Hono, Express, Koa, Vafast, Vafast-Mini）
- 等待每个服务器就绪
- 显示服务器状态
- 支持 Ctrl+C 优雅停止所有服务器

### 服务器端口配置
- **Elysia**: http://localhost:3000
- **Hono**: http://localhost:3001  
- **Express**: http://localhost:3002
- **Koa**: http://localhost:3003
- **Vafast**: http://localhost:3004
- **Vafast-Mini**: http://localhost:3005

## 🧪 基准测试脚本

### 运行 K6 基准测试
```bash
bun run benchmark:k6
```

这个脚本会：
- 自动启动所有服务器
- 运行 k6 性能测试
- 生成 JSON 和 CSV 格式的报告
- 自动停止所有服务器

### 测试报告位置
- JSON 报告: `test-results/k6-{framework}-results.json`
- CSV 报告: `test-results/k6-{framework}-results.csv`

## 📊 工作流程建议

### 方式 1: 分离式（推荐用于开发调试）
```bash
# 1. 启动服务器
bun run start:servers

# 2. 在另一个终端运行测试
bun run benchmark:k6

# 3. 手动停止服务器（Ctrl+C）
```

### 方式 2: 一体化（推荐用于自动化测试）
```bash
# 直接运行完整测试
bun run benchmark:k6
```

## 🔧 自定义配置

### 修改服务器配置
编辑 `start-servers.ts` 中的 `frameworkConfigs` 数组：
```typescript
{
  name: "framework-name",
  displayName: "Framework Display Name", 
  directory: "frameworks/framework-name",
  startCommand: ["bun", "run", "src/index.ts"],
  port: 3000
}
```

### 修改 k6 测试配置
编辑 `k6-test-config.js` 中的测试参数：
- 测试时长
- 并发用户数
- 测试端点
- 阈值设置

## 🚨 故障排除

### 服务器启动失败
1. 检查端口是否被占用
2. 确认框架依赖已安装
3. 查看控制台错误信息

### 测试结果异常
1. 确认所有服务器都已就绪
2. 检查 k6 是否正确安装
3. 查看生成的报告文件

### 优雅停止
- 使用 `Ctrl+C` 停止脚本
- 脚本会自动清理所有子进程
- 确保端口被正确释放

## 📝 注意事项

1. **端口冲突**: 确保 3000-3005 端口未被其他服务占用
2. **依赖安装**: 每个框架目录都需要安装依赖 (`bun install`)
3. **k6 安装**: 需要全局安装 k6 工具
4. **权限问题**: 某些端口可能需要管理员权限

## 🔄 扩展功能

### 添加新框架
1. 在 `frameworks/` 目录下创建新框架
2. 在 `start-servers.ts` 中添加配置
3. 确保新框架有正确的启动命令和端口

### 自定义测试场景
1. 修改 `k6-test-config.js` 中的测试逻辑
2. 添加新的测试端点
3. 调整负载测试参数
