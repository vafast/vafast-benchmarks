# 🚀 简化版脚本说明

现在只有3个核心脚本，简单明了！

## 📋 核心脚本

### 1. **`test:single`** - 测试单个服务器
```bash
npm run test:single
```
**做什么**: 用K6测试当前服务器的性能
**结果**: 显示性能指标（RPS、延迟、冷启动等）

### 2. **`test:batch`** - 测试多个框架
```bash
npm run test:batch
```
**做什么**: 同时测试所有框架，对比性能
**结果**: 生成框架排名报告

### 3. **`demo`** - 演示功能
```bash
npm run demo
```
**做什么**: 用模拟数据演示批量测试器功能
**结果**: 生成示例报告（无需真实环境）

## 🎯 使用建议

### 新手入门
```bash
npm run demo          # 先看演示
```

### 测试性能
```bash
npm run test:single   # 测试当前服务器
```

### 框架对比
```bash
npm run test:batch    # 对比不同框架
```

## 💡 就这么简单！

- **`test:single`** = 测一个
- **`test:batch`** = 测多个  
- **`demo`** = 看演示

3个命令，搞定所有需求！🚀
