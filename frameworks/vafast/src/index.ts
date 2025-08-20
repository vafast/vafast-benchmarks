import { defineRoutes, createRouteHandler } from "vafast";
import type { Route } from "vafast";
import { Server } from "vafast";
import { Type } from "@sinclair/typebox";
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

// 使用vafast defineRoutes - 简洁清晰
const routes = defineRoutes([
  // 基本路由
  {
    method: "GET",
    path: "/",
    handler: createRouteHandler(() => {
      return { message: "Hello Vafast!" };
    }),
  },

  // ===== TechEmpower 风格测试接口 =====

  // JSON序列化测试
  {
    method: "GET",
    path: "/techempower/json",
    handler: createRouteHandler(() => {
      return { message: "Hello, World!" };
    }),
  },

  // 纯文本测试
  {
    method: "GET",
    path: "/techempower/plaintext",
    handler: createRouteHandler(() => {
      return "Hello, World!";
    }),
  },

  // 数据库查询测试
  {
    method: "GET",
    path: "/techempower/db",
    handler: createRouteHandler(({ query }) => {
      return simulateDatabaseQuery(query.queries);
    }),
  },

  // 数据库更新测试
  {
    method: "GET",
    path: "/techempower/updates",
    handler: createRouteHandler(({ query }) => {
      return simulateDatabaseUpdate(query.queries);
    }),
  },

  // 复杂对象序列化测试
  {
    method: "GET",
    path: "/techempower/complex-json",
    handler: createRouteHandler(({ query }) => {
      return simulateComplexJsonSerialization(query.depth);
    }),
  },

  // 批量数据处理测试 (使用TypeBox验证)
  {
    method: "POST",
    path: "/techempower/batch-process",
    handler: createRouteHandler(
      ({ body }) => {
        return simulateBatchProcessing(body);
      },
      {
        body: BatchProcessSchema,
      }
    ),
  },

  // ===== Schema 验证接口 =====

  // 综合验证接口 (使用TypeBox验证)
  {
    method: "POST",
    path: "/schema/validate",
    handler: createRouteHandler(
      ({ body, query }) => {
        return {
          success: true,
          validatedBody: body,
          validatedQuery: query,
          timestamp: new Date().toISOString(),
        };
      },
      {
        body: TestSchema,
      }
    ),
  },
] as const satisfies Route[]);

// 使用vafast Server - 简单直接
const server = new Server(routes);

console.log(`⚡ Vafast is running at http://localhost:3005`);
console.log("📊 Available benchmark endpoints:");
console.log("=== Schema 验证接口 ===");
console.log("  POST /schema/validate               - 综合验证接口 (使用 vafast createRouteHandler + TypeBox)");

console.log("=== TechEmpower 风格测试接口 ===");
console.log("  GET  /techempower/json                          - JSON序列化测试");
console.log("  GET  /techempower/plaintext                     - 纯文本测试");
console.log("  GET  /techempower/db                            - 数据库查询测试");
console.log("  GET  /techempower/updates                       - 数据库更新测试");
console.log("  GET  /techempower/complex-json                  - 复杂对象序列化测试");
console.log("  POST /techempower/batch-process                 - 批量数据处理测试 (使用 vafast createRouteHandler + TypeBox)");

// 导出服务器
export default {
  port: 3005,
  fetch: (req: Request) => server.fetch(req),
};