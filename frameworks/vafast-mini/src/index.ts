import { defineRoutes } from "vafast";
import type { Route } from "vafast";
import { Server } from "vafast";
import { parseQuery, parseBody, json, VafastError } from "vafast";
import { Type } from "@sinclair/typebox";
import { TypeCompiler } from "@sinclair/typebox/compiler";
import {
  simulateDatabaseQuery,
  simulateDatabaseUpdate,
  simulateComplexJsonSerialization,
  simulateBatchProcessing,
} from "../../../utils";

// TypeBox Schema 定义 - 使用与其他框架一致的复杂schema
const TestSchema = Type.Object({
  user: Type.Object({
    name: Type.String({ minLength: 2, maxLength: 50 }),
    phone: Type.String({ pattern: "^1[3-9]\\d{9}$" }),
    age: Type.Number({ minimum: 0, maximum: 120 }),
    email: Type.String({ format: "email" }),
    active: Type.Boolean(),
    tags: Type.Array(Type.String()),
    preferences: Type.Object({
      theme: Type.Union([Type.Literal("light"), Type.Literal("dark")]),
      language: Type.String(),
    }),
  }),
  metadata: Type.Object({
    version: Type.String(),
    timestamp: Type.String(),
  }),
});

const BatchProcessSchema = Type.Object({
  items: Type.Array(
    Type.Object({
      id: Type.Number(),
      value: Type.Number(),
      name: Type.String(),
    })
  ),
  operation: Type.Union([Type.Literal("sum"), Type.Literal("average"), Type.Literal("count")]),
});

// 编译Schema以提高性能
const testSchemaCompiled = TypeCompiler.Compile(TestSchema);
const batchSchemaCompiled = TypeCompiler.Compile(BatchProcessSchema);

const routes = defineRoutes([
  // 基本路由
  {
    method: "GET",
    path: "/",
    handler: () => json({ message: "Hello Vafast-mini!" }),
  },

  // 健康检查路由
  {
    method: "GET",
    path: "/health",
    handler: () => new Response("✅ OK"),
  },

  // ===== TechEmpower 风格测试接口 =====

  // JSON序列化测试
  {
    method: "GET",
    path: "/techempower/json",
    handler: () => json({ message: "Hello, World!" }),
  },

  // 纯文本测试
  {
    method: "GET",
    path: "/techempower/plaintext",
    handler: () =>
      new Response("Hello, World!", {
        headers: { "Content-Type": "text/plain" },
      }),
  },

  // 数据库查询测试
  {
    method: "GET",
    path: "/techempower/db",
    handler: (req) => {
      const query = parseQuery(req);
      const queries = query.get("queries") || undefined;
      const result = simulateDatabaseQuery(queries);
      return json(result);
    },
  },

  // 数据库更新测试
  {
    method: "GET",
    path: "/techempower/updates",
    handler: (req) => {
      const query = parseQuery(req);
      const queries = query.get("queries") || undefined;
      const result = simulateDatabaseUpdate(queries);
      return json(result);
    },
  },

  // 复杂对象序列化测试
  {
    method: "GET",
    path: "/techempower/complex-json",
    handler: (req) => {
      const query = parseQuery(req);
      const depth = query.get("depth") || undefined;
      const result = simulateComplexJsonSerialization(depth);
      return json(result);
    },
  },

  // 批量数据处理测试 (使用TypeBox原生验证)
  {
    method: "POST",
    path: "/techempower/batch-process",
    handler: async (req: Request) => {
      try {
        const body = await parseBody(req);

        // TypeBox原生验证
        const isValid = batchSchemaCompiled.Check(body);
        if (!isValid) {
          const errors = [...batchSchemaCompiled.Errors(body)];
          const errorMessage = `Body validation failed: ${errors.map((e) => e.message).join(", ")}`;
          throw new VafastError(errorMessage, {
            status: 400,
            type: "validation_error",
            expose: true,
          });
        }

        const result = simulateBatchProcessing(body);
        return json(result);
      } catch (error) {
        throw new VafastError(error instanceof Error ? error.message : "Unknown error", {
          status: 500,
          type: "internal_error",
          expose: false,
        });
      }
    },
  },

  // ===== Schema 验证接口 =====

  // 综合验证接口 (使用TypeBox原生验证)
  {
    method: "POST",
    path: "/schema/validate",
    handler: async (req: Request) => {
      try {
        const body = await parseBody(req);
        const query = parseQuery(req);

        // TypeBox原生验证
        const isValid = testSchemaCompiled.Check(body);
        if (!isValid) {
          const errors = [...testSchemaCompiled.Errors(body)];
          const errorMessage = `Body validation failed: ${errors.map((e) => e.message).join(", ")}`;
          throw new VafastError(errorMessage, {
            status: 400,
            type: "validation_error",
            expose: true,
          });
        }

        return json({
          success: true,
          validatedBody: body,
          validatedQuery: {
            page: query.get("page"),
            limit: query.get("limit"),
          },
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        throw new VafastError(error instanceof Error ? error.message : "Invalid JSON", {
          status: 400,
          type: "bad_request",
          expose: true,
        });
      }
    },
  },
] as const satisfies Route[]);

const server = new Server(routes);

console.log(`⚡ Vafast-mini is running at http://localhost:3004`);
console.log("📊 Available benchmark endpoints:");
console.log("=== Schema 验证接口 ===");
console.log("  POST /schema/validate               - 综合验证接口 (使用 TypeBox 原生验证)");
console.log("  POST /error-demo                    - VafastError 演示接口");

console.log("=== TechEmpower 风格测试接口 ===");
console.log("  GET  /techempower/json                          - JSON序列化测试");
console.log("  GET  /techempower/plaintext                     - 纯文本测试");
console.log("  GET  /techempower/db                            - 数据库查询测试");
console.log("  GET  /techempower/updates                       - 数据库更新测试");
console.log("  GET  /techempower/complex-json                  - 复杂对象序列化测试");
console.log(
  "  POST /techempower/batch-process                 - 批量数据处理测试 (使用 TypeBox 原生验证)"
);
console.log("=== 其他端点 ===");
console.log("  GET  /health                                    - 健康检查");

// 导出 fetch 函数，使 Bun 能够启动 HTTP 服务器
export default {
  port: 3004,
  fetch: (req: Request) => server.fetch(req),
};
