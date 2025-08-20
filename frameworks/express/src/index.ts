import express from "express";
import { Type as t, TSchema } from "@sinclair/typebox";
import { TypeCompiler } from "@sinclair/typebox/compiler";
import {
  simulateDatabaseQuery,
  simulateDatabaseUpdate,
  simulateComplexJsonSerialization,
  simulateBatchProcessing,
} from "../../../utils";

const app = express();
const port = 3002;

// 中间件
app.use(express.json());

// TypeBox 验证中间件
function validateBody<T extends TSchema>(schema: T) {
  const compiled = TypeCompiler.Compile(schema);

  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const isValid = compiled.Check(req.body);
      if (!isValid) {
        const errors = [...compiled.Errors(req.body)];
        return res.status(400).json({
          error: "Body validation failed",
          details: errors,
        });
      }
      next();
    } catch (error) {
      return res.status(400).json({
        error: "Validation failed",
        message: error instanceof Error ? error.message : "Unknown validation error",
      });
    }
  };
}

// 基本路由
app.get("/", (req, res) => {
  res.send("Hello Express!");
});

// ===== TechEmpower 风格测试接口 =====

// JSON序列化测试
app.get("/techempower/json", (req, res) => {
  res.json({ message: "Hello, World!" });
});

// 纯文本测试
app.get("/techempower/plaintext", (req, res) => {
  res.type("text").send("Hello, World!");
});

// 数据库查询测试
app.get("/techempower/db", (req, res) => {
  const queries = req.query.queries as string;
  res.json(simulateDatabaseQuery(queries));
});

// 数据库更新测试
app.get("/techempower/updates", (req, res) => {
  const queries = req.query.queries as string;
  res.json(simulateDatabaseUpdate(queries));
});

// 复杂对象序列化测试
app.get("/techempower/complex-json", (req, res) => {
  const depth = req.query.depth as string;
  res.json(simulateComplexJsonSerialization(depth));
});

// TypeBox Schema 定义
const BatchProcessSchema = t.Object({
  items: t.Array(
    t.Object({
      id: t.Number(),
      value: t.Number(),
      name: t.String(),
    })
  ),
  operation: t.Union([t.Literal("sum"), t.Literal("average"), t.Literal("count")]),
});

const ValidateSchema = t.Object({
  user: t.Object({
    name: t.String({ minLength: 2, maxLength: 50 }),
    phone: t.String({ pattern: "^1[3-9]\\d{9}$" }),
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
});

// 批量数据处理测试
app.post("/techempower/batch-process", validateBody(BatchProcessSchema), (req, res) => {
  try {
    const result = simulateBatchProcessing(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ===== Schema 验证接口 =====

// 综合验证接口
app.post("/schema/validate", validateBody(ValidateSchema), (req, res) => {
  const { page, limit } = req.query;

  res.json({
    success: true,
    validatedBody: req.body,
    validatedQuery: { page, limit },
    timestamp: new Date().toISOString(),
  });
});

// 启动服务器
app.listen(port, () => {
  console.log(`🚀 Express is running at http://localhost:${port}`);
  console.log("📊 Available benchmark endpoints:");
  console.log("=== Schema 验证接口 ===");
  console.log("  POST /schema/validate               - 综合验证接口 (使用 TypeBox 编译器)");

  console.log("=== TechEmpower 风格测试接口 ===");
  console.log("  GET  /techempower/json                          - JSON序列化测试");
  console.log("  GET  /techempower/plaintext                     - 纯文本测试");
  console.log("  GET  /techempower/db                            - 数据库查询测试");
  console.log("  GET  /techempower/updates                       - 数据库更新测试");
  console.log("  GET  /techempower/complex-json                  - 复杂对象序列化测试");
  console.log(
    "  POST /techempower/batch-process                 - 批量数据处理测试 (使用 TypeBox 编译器)"
  );
});

export default app;
