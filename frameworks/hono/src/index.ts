import { Hono } from "hono";
import { tbValidator } from "@hono/typebox-validator";
import { Type as t } from "@sinclair/typebox";
import {
  simulateDatabaseQuery,
  simulateDatabaseUpdate,
  simulateComplexJsonSerialization,
  simulateBatchProcessing,
} from "../../../utils";

const app = new Hono();

// 基本路由
app.get("/", (c) => {
  return c.text("Hello Hono!");
});

// ===== TechEmpower 风格测试接口 =====

// JSON序列化测试 - 模拟TechEmpower的JSON测试
app.get("/techempower/json", (c) => {
  return c.json({ message: "Hello, World!" });
});

// 纯文本测试 - 模拟TechEmpower的Plaintext测试
app.get("/techempower/plaintext", (c) => {
  return c.text("Hello, World!");
});

// 数据库查询测试 - 模拟TechEmpower的Database查询测试
app.get("/techempower/db", (c) => {
  const queries = c.req.query("queries");
  return c.json(simulateDatabaseQuery(queries));
});

// 数据库更新测试 - 模拟TechEmpower的Database更新测试
app.get("/techempower/updates", (c) => {
  const queries = c.req.query("queries");
  return c.json(simulateDatabaseUpdate(queries));
});

// 复杂对象序列化测试
app.get("/techempower/complex-json", (c) => {
  const depth = c.req.query("depth");
  return c.json(simulateComplexJsonSerialization(depth));
});

// 批量数据处理测试
app.post(
  "/techempower/batch-process",
  tbValidator(
    "json",
    t.Object({
      items: t.Array(
        t.Object({
          id: t.Number(),
          value: t.Number(),
          name: t.String(),
        })
      ),
      operation: t.Union([t.Literal("sum"), t.Literal("average"), t.Literal("count")]),
    })
  ),
  async (c) => {
    try {
      const body = c.req.valid("json");
      return c.json(simulateBatchProcessing(body));
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  }
);

// ===== Schema 验证接口 =====

// 综合验证接口 - 测试各种验证规则，使用TypeBox验证器
app.post(
  "/schema/validate",
  tbValidator(
    "json",
    t.Object({
      user: t.Object({
        name: t.String({ minLength: 2, maxLength: 50 }),
        phone: t.String({ pattern: "^1[3-9]\\d{9}$" }), // 中国手机号格式
        age: t.Number({ minimum: 0, maximum: 120 }),
        active: t.Boolean(),
        tags: t.Array(t.String()),
        preferences: t.Object({
          theme: t.Union([t.Literal("light"), t.Literal("dark")]),
          language: t.String(),
        }),
      }),
      metadata: t.Object({
        version: t.String(),
        timestamp: t.String(),
      }),
    })
  ),
  tbValidator(
    "query",
    t.Object({
      page: t.Optional(t.String({ pattern: "^[1-9]\\d*$" })),
      limit: t.Optional(t.String({ pattern: "^[1-9]\\d*$" })),
    })
  ),
  async (c) => {
    const body = c.req.valid("json");
    const query = c.req.valid("query");

    return c.json({
      success: true,
      validatedBody: body,
      validatedQuery: query,
      timestamp: new Date().toISOString(),
    });
  }
);

console.log(`🔥 Hono is running at http://localhost:3001`);
console.log("📊 Available benchmark endpoints:");
console.log("=== Schema 验证接口 ===");
console.log("  POST /schema/validate               - 综合验证接口 (使用 TypeBox 验证器)");

console.log("=== TechEmpower 风格测试接口 ===");
console.log("  GET  /techempower/json                          - JSON序列化测试");
console.log("  GET  /techempower/plaintext                     - 纯文本测试");
console.log("  GET  /techempower/db                            - 数据库查询测试");
console.log("  GET  /techempower/updates                       - 数据库更新测试");
console.log("  GET  /techempower/complex-json                  - 复杂对象序列化测试");
console.log(
  "  POST /techempower/batch-process                 - 批量数据处理测试 (使用 TypeBox 验证器)"
);

export default {
  port: 3001,
  fetch: app.fetch,
};
