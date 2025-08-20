/**
 * 运行所有性能测试并自动更新 README.md
 */

import { writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { TEST_CONFIG } from "./utils/benchmark-utils.js";

// 测试结果接口
interface TestResult {
  name: string;
  rps: number;
  duration: number;
}

// 运行测试并收集结果
async function runAllBenchmarks() {
  console.log("🚀 开始运行所有性能测试...");
  console.log("=".repeat(80));

  // 运行简单响应测试并收集结果
  console.log("\n📊 运行简单响应性能测试...");
  const simpleResponseResults = await runSimpleResponseBenchmark();
  if (!simpleResponseResults) {
    console.error("❌ 简单响应测试失败");
    return;
  }
  console.log("✅ 简单响应测试完成");

  // 运行验证器测试并收集结果
  console.log("\n🔍 运行验证器性能测试...");
  const validatorResults = await runValidatorBenchmark();
  if (!validatorResults) {
    console.error("❌ 验证器测试失败");
    return;
  }
  console.log("✅ 验证器测试完成");

  console.log("\n📝 开始更新 README.md...");
  await updateREADME(simpleResponseResults, validatorResults);
}

// 运行简单响应测试
async function runSimpleResponseBenchmark(): Promise<TestResult[] | null> {
  try {
    // 动态导入并执行简单响应测试
    const { runSimpleResponseBenchmark: actualRun } = await import(
      "./simple-response-benchmark.js"
    );
    return await actualRun();
  } catch (error) {
    console.error("❌ 简单响应测试失败:", error);
    return null;
  }
}

// 运行验证器测试
async function runValidatorBenchmark(): Promise<TestResult[] | null> {
  try {
    // 动态导入并执行验证器测试
    const { runValidatorBenchmark: actualRun } = await import("./validator-benchmark.js");
    return await actualRun();
  } catch (error) {
    console.error("❌ 验证器测试失败:", error);
    return null;
  }
}

// 格式化性能数据
function formatPerformance(rps: number): string {
  if (rps >= 1_000_000) {
    return `${(rps / 1_000_000).toFixed(2)}M`;
  } else if (rps >= 1_000) {
    return `${(rps / 1_000).toFixed(2)}K`;
  } else {
    return rps.toString();
  }
}

// 格式化时间
function formatTime(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`;
  } else if (ms >= 1) {
    return `${ms.toFixed(2)}ms`;
  } else {
    return `${(ms * 1000).toFixed(2)}μs`;
  }
}

// 更新 README.md 文件
async function updateREADME(simpleResults: TestResult[], validatorResults: TestResult[]) {
  try {
    const readmePath = join(process.cwd(), "README.md");
    let readmeContent = readFileSync(readmePath, "utf8");

    const today = new Date().toISOString().split("T")[0];

    // 生成简单响应测试结果
    let simpleResponseResults = "";
    if (simpleResults.length > 0) {
      const sortedResults = [...simpleResults].sort((a, b) => b.rps - a.rps);

      simpleResponseResults += `| 框架 | 请求/秒 | 平均耗时 | 总耗时 | 排名 |\n`;
      simpleResponseResults += `|------|----------|----------|--------|------|\n`;

      sortedResults.forEach((result, index) => {
        const performance =
          index === 0 ? "🥇 第一" : index === 1 ? "🥈 第二" : index === 2 ? "🥉 第三" : "📊";
        const rpsFormatted = formatPerformance(result.rps);
        const avgTime = formatTime(result.duration / (result.rps * (result.duration / 1000)));
        const totalTime = formatTime(result.duration);

        simpleResponseResults += `| ${result.name} | ${rpsFormatted} | ${avgTime} | ${totalTime} | ${performance} |\n`;
      });

      // 添加测试摘要
      const totalTime = simpleResults.reduce((sum, r) => sum + r.duration, 0);
      const fastest = simpleResults.reduce((fastest, r) => (r.rps > fastest.rps ? r : fastest));
      const slowest = simpleResults.reduce((slowest, r) => (r.rps < slowest.rps ? r : slowest));

      simpleResponseResults += `\n**测试摘要**\n`;
      simpleResponseResults += `- 每个测试: ${TEST_CONFIG.iterations.toLocaleString()} 次请求\n`;
      simpleResponseResults += `- 总耗时: ${formatTime(totalTime)}\n`;
      simpleResponseResults += `- 性能差距: ${((fastest.rps / slowest.rps - 1) * 100).toFixed(
        1
      )}%\n`;
    }

    // 生成验证器测试结果
    let validatorResultsText = "";
    if (validatorResults.length > 0) {
      const sortedResults = [...validatorResults].sort((a, b) => b.rps - a.rps);

      validatorResultsText += `| 框架 | 请求/秒 | 平均耗时 | 总耗时 | 排名 |\n`;
      validatorResultsText += `|------|----------|----------|--------|------|\n`;

      sortedResults.forEach((result, index) => {
        const performance =
          index === 0 ? "🥇 第一" : index === 1 ? "🥈 第二" : index === 2 ? "🥉 第三" : "📊";
        const rpsFormatted = formatPerformance(result.rps);
        const avgTime = formatTime(result.duration / (result.rps * (result.duration / 1000)));
        const totalTime = formatTime(result.duration);

        validatorResultsText += `| ${result.name} | ${rpsFormatted} | ${avgTime} | ${totalTime} | ${performance} |\n`;
      });

      // 添加测试摘要
      const totalTime = validatorResults.reduce((sum, r) => sum + r.duration, 0);
      const fastest = validatorResults.reduce((fastest, r) => (r.rps > fastest.rps ? r : fastest));
      const slowest = validatorResults.reduce((slowest, r) => (r.rps < slowest.rps ? r : slowest));

      validatorResultsText += `\n**测试摘要**\n`;
      validatorResultsText += `- 每个测试: ${TEST_CONFIG.iterations.toLocaleString()} 次请求\n`;
      validatorResultsText += `- 总耗时: ${formatTime(totalTime)}\n`;
      validatorResultsText += `- 性能差距: ${((fastest.rps / slowest.rps - 1) * 100).toFixed(
        1
      )}%\n`;
    }

    // 更新 README 中的测试结果部分
    if (simpleResponseResults || validatorResults.length > 0) {
      // 查找测试结果部分并替换
      const testResultsRegex = /## 📈 最新测试结果[\s\S]*?(?=## 🎯 性能分析|$)/;

      let newTestResults = "## 📈 最新测试结果\n\n";

      if (simpleResponseResults) {
        newTestResults += `### 简单响应性能测试 (${today})\n\n`;
        newTestResults += simpleResponseResults + "\n";
      }

      if (validatorResults.length > 0) {
        newTestResults += `### 验证器性能测试 (${today})\n\n`;
        newTestResults += validatorResultsText + "\n";
      }

      // 直接写入测试报告到 README.md
      const readmeContent = `# vafast 框架性能评测

> 最后更新: ${today}  
> 测试环境: macOS 24.6.0, Bun 1.0.0

${newTestResults}`;

      writeFileSync(readmePath, readmeContent, "utf8");
      console.log("✅ README.md 已更新");
      console.log(`📄 写入了最新的测试报告`);
      console.log(`📅 最后更新时间: ${today}`);
    } else {
      console.log("⚠️  没有找到测试结果，README.md 未更新");
    }
  } catch (error) {
    console.error("❌ 更新 README.md 失败:", error);
  }
}

// 主函数
async function main() {
  try {
    await runAllBenchmarks();
    console.log("\n🎉 所有测试完成，README.md 已更新！");
  } catch (error) {
    console.error("❌ 运行失败:", error);
    process.exit(1);
  }
}

// 运行脚本
if (require.main === module) {
  main();
}

export { runAllBenchmarks, updateREADME };
