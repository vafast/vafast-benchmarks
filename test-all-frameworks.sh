#!/bin/bash

# 测试所有框架和所有接口的性能测试脚本
# 生成完整的性能基准测试报告

echo "🚀 开始全面性能基准测试"
echo "=========================================="

# 定义框架和接口
frameworks=("elysia" "hono" "express" "koa" "vafast" "vafast-mini")
interfaces=("json" "plaintext" "db" "updates" "complex-json" "batch-process" "schema-validate")

total_tests=$((${#frameworks[@]} * ${#interfaces[@]}))
current_test=0

echo "📊 将执行 ${total_tests} 个测试 (${#frameworks[@]} 个框架 × ${#interfaces[@]} 个接口)"
echo ""

# 记录测试开始时间
start_time=$(date +%s)

# 创建测试结果汇总
declare -A test_results

echo "📋 测试计划："
for framework in "${frameworks[@]}"; do
    echo "  🔹 ${framework}: ${interfaces[*]}"
done
echo ""

# 执行测试
for framework in "${frameworks[@]}"; do
    echo "🎯 测试框架: ${framework}"
    echo "----------------------------------------"
    
    for interface in "${interfaces[@]}"; do
        current_test=$((current_test + 1))
        progress=$(echo "scale=1; $current_test * 100 / $total_tests" | bc)
        
        echo "[$current_test/$total_tests] (${progress}%) 测试 ${framework} ${interface}..."
        
        # 运行测试
        if node run-k6-tests.js "$framework" "$interface"; then
            test_results["${framework}_${interface}"]="✅ SUCCESS"
            echo "✅ ${framework} ${interface} 测试完成"
        else
            test_results["${framework}_${interface}"]="❌ FAILED"
            echo "❌ ${framework} ${interface} 测试失败"
        fi
        
        echo ""
        
        # 给服务器一些恢复时间
        sleep 2
    done
    
    echo "✅ ${framework} 所有接口测试完成"
    echo ""
done

# 计算总测试时间
end_time=$(date +%s)
total_time=$((end_time - start_time))
minutes=$((total_time / 60))
seconds=$((total_time % 60))

echo "🎉 全面性能基准测试完成！"
echo "=========================================="
echo "⏰ 总测试时间: ${minutes}分${seconds}秒"
echo "📊 测试总数: ${total_tests}"
echo ""

# 显示测试结果汇总
echo "📋 测试结果汇总："
echo "=========================================="

success_count=0
fail_count=0

for framework in "${frameworks[@]}"; do
    echo "🔹 ${framework}:"
    for interface in "${interfaces[@]}"; do
        result=${test_results["${framework}_${interface}"]}
        echo "    ${interface}: ${result}"
        if [[ $result == *"SUCCESS"* ]]; then
            success_count=$((success_count + 1))
        else
            fail_count=$((fail_count + 1))
        fi
    done
    echo ""
done

echo "=========================================="
echo "✅ 成功: ${success_count} 个测试"
echo "❌ 失败: ${fail_count} 个测试"
echo "📈 成功率: $(echo "scale=1; $success_count * 100 / $total_tests" | bc)%"
echo ""

echo "📁 测试报告位于: ./test-results/"
echo "🔍 查看详细报告请检查各框架的测试结果目录"

if [ $fail_count -eq 0 ]; then
    echo "🏆 所有测试都成功完成！"
    exit 0
else
    echo "⚠️  有 ${fail_count} 个测试失败，请检查错误日志"
    exit 1
fi