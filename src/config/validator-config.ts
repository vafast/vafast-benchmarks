/**
 * 复杂验证器测试配置
 */

import { Elysia } from "elysia";
import { Hono } from "hono";
import { tbValidator } from "@hono/typebox-validator";
import { createRouteHandler } from "vafast";
import { Type } from "@sinclair/typebox";
import express from "express";
import { TypeCompiler } from "@sinclair/typebox/compiler";

// ============================================================================
// 复杂验证器测试配置
// ============================================================================
export const TestSchema = Type.Object({
  user: Type.Object({
    id: Type.String({ minLength: 1, maxLength: 100 }),
    name: Type.String({ minLength: 1, maxLength: 100 }),
    email: Type.String({ minLength: 5, maxLength: 100 }),
    age: Type.Number({ minimum: 0, maximum: 150 }),
    profile: Type.Object({
      bio: Type.Optional(Type.String({ maxLength: 500 })),
      avatar: Type.Optional(Type.String({ maxLength: 200 })),
      preferences: Type.Object({
        theme: Type.Union([Type.Literal("light"), Type.Literal("dark")]),
        notifications: Type.Boolean(),
        language: Type.String({ minLength: 2, maxLength: 5 }),
      }),
    }),
    tags: Type.Array(Type.String(), { minItems: 0, maxItems: 10 }),
    metadata: Type.Record(Type.String(), Type.Any()),
  }),
  timestamp: Type.String({ maxLength: 50 }),
  version: Type.String({ maxLength: 20 }),
});

// vafast 原生验证器路由
export const vafastValidatorRoutes = [
  {
    method: "GET",
    path: "/",
    handler: createRouteHandler(
      {
        body: TestSchema,
      },
      ({ body }) => {
        return new Response(JSON.stringify({ message: "Hello World", data: body }));
      }
    ),
  },
];

// Elysia 验证器应用
export const elysiaValidatorApp = new Elysia().post(
  "/",
  ({ body }) => {
    return { message: "Hello World", data: { body } };
  },
  {
    body: TestSchema,
  }
);

// Hono 验证器应用 - 使用原生的 tbValidator
export const honoValidatorApp = new Hono().post("/", tbValidator("json", TestSchema), async (c) => {
  const body = c.req.valid("json");

  return c.json({ message: "Hello World", data: { body } });
});

// Express 验证器应用
export const expressValidatorApp = express();
expressValidatorApp.use(express.json());

// 修复：预编译验证器，避免每次请求都重新编译
export const expressBodyValidator = TypeCompiler.Compile(TestSchema);

expressValidatorApp.post("/", (req, res) => {
  try {
    // 验证 body
    const bodyValid = expressBodyValidator.Check(req.body);
    if (!bodyValid) {
      const bodyErrors = expressBodyValidator.Errors(req.body);
      return res.status(400).json({ error: "Body validation failed", details: bodyErrors });
    }

    res.json({
      message: "Hello World",
      data: { body: req.body },
    });
  } catch (error) {
    res.status(400).json({ error: "Validation failed" });
  }
});
