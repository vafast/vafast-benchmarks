/**
 * 简单响应测试配置
 */

import { Elysia } from "elysia";
import { Hono } from "hono";
import { createRouteHandler } from "vafast";
import express from "express";
import Koa from "koa";
import Router from "@koa/router";
import bodyParser from "koa-bodyparser";

// ============================================================================
// 简单响应测试配置
// ============================================================================
export const simpleMessage = "Hello, World!";

// 1. 原生 Response - 性能基准
export const nativeResponse = () =>
  new Response(simpleMessage, {
    headers: { "Content-Type": "text/plain" },
  });

// 2. Elysia 框架
export const elysiaApp = new Elysia().post("/", ({ body }) => {
  return { message: simpleMessage, data: body };
});

// 3. Hono 框架
export const honoApp = new Hono().post("/", async (c) => {
  const body = await c.req.json();
  return c.json({ message: simpleMessage, data: body });
});

// 4. Express 框架
export const expressApp = express();
expressApp.use(express.json());
expressApp.post("/", (req, res) => {
  res.json({ message: simpleMessage, data: req.body });
});

// 5. Koa 框架
export const koaApp = new Koa();
const koaRouter = new Router();
koaApp.use(bodyParser());
koaRouter.post("/", async (ctx) => {
  ctx.body = { message: simpleMessage, data: (ctx.request as any).body };
});
koaApp.use(koaRouter.routes());
koaApp.use(koaRouter.allowedMethods());

// Koa 请求处理函数
export async function handleKoaRequest(req: Request): Promise<Response> {
  const body = await req.json();

  // 创建模拟的 Koa 上下文
  const ctx = {
    request: { body },
    body: "",
    status: 200,
    set: (name: string, value: string) => {},
  } as any;

  // 直接调用路由处理器
  await koaRouter.routes()(ctx, async () => {});

  return new Response(JSON.stringify(ctx.body), {
    status: ctx.status,
    headers: { "Content-Type": "application/json" },
  });
}

// Express 请求处理函数 - 修复：直接使用expressApp处理请求
export async function handleExpressRequest(req: Request): Promise<Response> {
  // 将 Request 转换为 Express 兼容的格式
  const url = new URL(req.url);
  const body = await req.json();

  const expressReq = {
    url: req.url,
    method: req.method,
    headers: Object.fromEntries(req.headers.entries()),
    body: body,
  } as any;

  const expressRes = {
    statusCode: 200,
    headers: {} as any,
    body: "",
    set: function (name: string, value: string) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },
    send: function (data: any) {
      this.body = data;
      return this;
    },
    json: function (data: any) {
      this.headers["content-type"] = "application/json";
      this.body = JSON.stringify(data);
      return this;
    },
  } as any;

  // 调用 Express 路由处理器
  const route = expressApp._router.stack.find(
    (layer: any) =>
      layer.route &&
      layer.route.path === url.pathname &&
      layer.route.methods[req.method.toLowerCase()]
  );

  if (route) {
    route.handle(expressReq, expressRes, () => {});
    return new Response(expressRes.body, {
      status: expressRes.statusCode,
      headers: expressRes.headers,
    });
  }

  return new Response("Not Found", { status: 404 });
}

// 5. vafast 原生 - 直接路由
export const vafastRoutesDirect = [
  {
    method: "GET",
    path: "/",
    handler: () =>
      new Response(simpleMessage, {
        headers: { "Content-Type": "text/plain" },
      }),
  },
];

// 6. vafast 原生 - 工厂路由
export const vafastRoutesFactory = [
  {
    method: "GET",
    path: "/",
    handler: createRouteHandler({}, () => {
      return new Response(simpleMessage, {
        headers: { "Content-Type": "text/plain" },
      });
    }),
  },
];
