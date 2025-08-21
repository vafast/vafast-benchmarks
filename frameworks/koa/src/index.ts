import Koa from "koa";
import Router from "@koa/router";
import bodyParser from "koa-bodyparser";
import { Type as t, TSchema } from "@sinclair/typebox";
import { TypeCompiler } from "@sinclair/typebox/compiler";

// 扩展 Koa 类型定义
declare module "koa" {
  interface Request {
    body: any;
  }
}
import {
  simulateDatabaseQuery,
  simulateDatabaseUpdate,
  simulateComplexJsonSerialization,
  simulateBatchProcessing,
} from "../../../utils";

const app = new Koa();
const router = new Router();
const port = 3000;

// 中间件
app.use(bodyParser({}));

// TypeBox 验证中间件
function validateBodyKoa<T extends TSchema>(schema: T) {
  const compiled = TypeCompiler.Compile(schema);

  return async (ctx: Koa.Context, next: Koa.Next) => {
    try {
      const isValid = compiled.Check(ctx.request.body);
      if (!isValid) {
        const errors = [...compiled.Errors(ctx.request.body)];
        ctx.status = 400;
        ctx.body = {
          error: "Body validation failed",
          details: errors,
        };
        return;
      }
      await next();
    } catch (error) {
      ctx.status = 400;
      ctx.body = {
        error: "Validation failed",
        message: error instanceof Error ? error.message : "Unknown validation error",
      };
    }
  };
}

// 健康检查端点
router.get("/health", async (ctx) => {
  ctx.body = { status: "ok", timestamp: new Date().toISOString() };
});

// 基本路由
router.get("/", async (ctx) => {
  ctx.body = "Hello Koa!";
});

// ===== TechEmpower 风格测试接口 =====

// JSON序列化测试
router.get("/techempower/json", async (ctx) => {
  ctx.body = { message: "Hello, World!" };
});

// 纯文本测试
router.get("/techempower/plaintext", async (ctx) => {
  ctx.type = "text/plain";
  ctx.body = "Hello, World!";
});

// 数据库查询测试
router.get("/techempower/db", async (ctx) => {
  const queries = ctx.query.queries as string;
  ctx.body = simulateDatabaseQuery(queries);
});

// 数据库更新测试
router.get("/techempower/updates", async (ctx) => {
  const queries = ctx.query.queries as string;
  ctx.body = simulateDatabaseUpdate(queries);
});

// 复杂对象序列化测试
router.get("/techempower/complex-json", async (ctx) => {
  const depth = ctx.query.depth as string;
  ctx.body = simulateComplexJsonSerialization(depth);
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
router.post("/techempower/batch-process", validateBodyKoa(BatchProcessSchema), async (ctx) => {
  try {
    const result = simulateBatchProcessing(ctx.request.body);
    ctx.body = result;
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
});

// ===== Schema 验证接口 =====

// 综合验证接口
router.post("/schema/validate", validateBodyKoa(ValidateSchema), async (ctx) => {
  const { page, limit } = ctx.query;

  ctx.body = {
    success: true,
    validatedBody: ctx.request.body,
    validatedQuery: { page, limit },
    timestamp: new Date().toISOString(),
  };
});

// 注册路由
app.use(router.routes());
app.use(router.allowedMethods());

// 启动服务器
app.listen(port, () => {
  console.log(`🌊 Koa is running at http://localhost:${port}`);
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
