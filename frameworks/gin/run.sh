#!/bin/bash

# Gin 框架启动脚本

echo "🚀 Starting Gin framework server..."

# 检查 Go 是否安装
if ! command -v go &> /dev/null; then
    echo "❌ Go is not installed. Please install Go first."
    exit 1
fi

# 进入 Gin 框架目录
cd "$(dirname "$0")"

# 下载依赖
echo "📦 Installing dependencies..."
go mod tidy

# 启动服务器
echo "🎯 Starting Gin server on port 3000..."
go run main.go