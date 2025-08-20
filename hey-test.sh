#!/bin/bash

# hey 测试脚本
# 需要先安装: go install github.com/rakyll/hey@latest

BASE_URL="http://localhost:3000"
HEY_PATH="/Users/fuguoqiang/go/bin/hey"

echo "🚀 开始 hey 性能测试..."
echo "=================================="

echo "📊 测试 JSON 接口 (1000 请求, 10 并发)"
$HEY_PATH -n 1000 -c 10 "$BASE_URL/techempower/json"

echo "📊 测试纯文本接口 (1000 请求, 10 并发)"
$HEY_PATH -n 1000 -c 10 "$BASE_URL/techempower/plaintext"

echo "📊 测试数据库查询接口 (500 请求, 5 并发)"
$HEY_PATH -n 500 -c 5 "$BASE_URL/techempower/db?queries=10"

echo "📊 测试复杂JSON接口 (300 请求, 3 并发)"
$HEY_PATH -n 300 -c 3 "$BASE_URL/techempower/complex-json?depth=5"

echo "📊 测试批量处理接口 (200 请求, 2 并发)"
$HEY_PATH -n 200 -c 2 -m POST -H "Content-Type: application/json" \
  -d '{"items":[{"id":1,"value":100,"name":"Item 1"}],"operation":"sum"}' \
  "$BASE_URL/techempower/batch-process"

echo "✅ 所有测试完成!"
