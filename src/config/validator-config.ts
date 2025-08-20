/**
 * 复杂验证器测试配置
 */

import { Elysia, t } from "elysia";
import { Hono } from "hono";
import { tbValidator } from "@hono/typebox-validator";
import { createRouteHandler } from "vafast";
import { Type } from "@sinclair/typebox";
import express from "express";
import { TypeCompiler } from "@sinclair/typebox/compiler";
import Koa from "koa";
import Router from "@koa/router";
import bodyParser from "koa-bodyparser";

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

// 使用 Elysia 原生 Schema，避免与 TypeBox TSchema 的符号冲突
const ElysiaSchema = t.Object({
  user: t.Object({
    id: t.String(),
    name: t.String(),
    email: t.String(),
    age: t.Number(),
    profile: t.Object({
      bio: t.Optional(t.String()),
      avatar: t.Optional(t.String()),
      preferences: t.Object({
        theme: t.Union([t.Literal("light"), t.Literal("dark")]),
        notifications: t.Boolean(),
        language: t.String(),
      }),
    }),
    tags: t.Array(t.String()),
    metadata: t.Record(t.String(), t.Any()),
  }),
  timestamp: t.String(),
  version: t.String(),
});

// vafast 原生验证器路由
export const vafastValidatorRoutes = [
  {
    method: "POST",
    path: "/",
    handler: createRouteHandler(
      {
        body: TestSchema,
      },
      ({ body }) => {
        return { message: "Hello World", data: body };
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
    body: ElysiaSchema,
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

// 预编译：避免每次请求重复编译 TypeBox 校验器
const expressBodyValidator = TypeCompiler.Compile(TestSchema);

expressValidatorApp.post("/", (req, res) => {
  try {
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

// Koa 验证器应用
export const koaValidatorApp = new Koa();
const koaValidatorRouter = new Router();
koaValidatorApp.use(bodyParser());

// 预编译：避免每次请求重复编译 TypeBox 校验器
const koaBodyValidator = TypeCompiler.Compile(TestSchema);

koaValidatorRouter.post("/", async (ctx) => {
  try {
    const requestBody = (ctx.request as any).body;
    const bodyValid = koaBodyValidator.Check(requestBody);
    if (!bodyValid) {
      const bodyErrors = koaBodyValidator.Errors(requestBody);
      ctx.status = 400;
      ctx.body = { error: "Body validation failed", details: bodyErrors };
      return;
    }

    ctx.body = {
      message: "Hello World",
      data: { body: requestBody },
    };
  } catch (error) {
    ctx.status = 400;
    ctx.body = { error: "Validation failed" };
  }
});

koaValidatorApp.use(koaValidatorRouter.routes());
koaValidatorApp.use(koaValidatorRouter.allowedMethods());

// 导出路由供测试使用
export { koaValidatorRouter };
