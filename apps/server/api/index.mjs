import { createContext } from "@elector/api/context";
import { appRouter } from "@elector/api/routers/index";
import { env } from "@elector/env/server";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

//#region src/app.ts
const app = new Hono();
app.use(logger());
app.use("/*", cors({
	origin: env.CORS_ORIGIN || (env.NODE_ENV === "production" ? "https://elector-server.vercel.app" : "*"),
	allowMethods: [
		"GET",
		"POST",
		"OPTIONS"
	]
}));
const apiHandler = new OpenAPIHandler(appRouter, {
	plugins: [new OpenAPIReferencePlugin({ schemaConverters: [new ZodToJsonSchemaConverter()] })],
	interceptors: [onError((error) => {
		console.error(error);
	})]
});
const rpcHandler = new RPCHandler(appRouter, { interceptors: [onError((error) => {
	console.error(error);
})] });
app.use("/*", async (c, next) => {
	const context = await createContext({ context: c });
	const rpcResult = await rpcHandler.handle(c.req.raw, {
		prefix: "/rpc",
		context
	});
	if (rpcResult.matched) return rpcResult.response;
	const apiResult = await apiHandler.handle(c.req.raw, {
		prefix: "/api-reference",
		context
	});
	if (apiResult.matched) return apiResult.response;
	await next();
});
app.get("/", (c) => {
	return c.text("OK");
});

//#endregion
//#region src/index.ts
var src_default = app;

//#endregion
export { src_default as default };