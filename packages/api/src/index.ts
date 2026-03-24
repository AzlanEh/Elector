import { os } from "@orpc/server";
import { env } from "@elector/env/server";

import type { Context } from "./context";

export const o = os.$context<Context>();

export const publicProcedure = o;

/**
 * Admin procedure — requires a valid `x-admin-secret` header matching
 * the ADMIN_SECRET env var.  Falls back to allow-all when ADMIN_SECRET
 * is not configured (development convenience).
 */
export const adminProcedure = o.use(({ context, next }) => {
  const configuredSecret = env.ADMIN_SECRET;

  if (env.NODE_ENV === "production" && !configuredSecret) {
    throw new Error("Unauthorized");
  }

  // If no secret is configured, allow through (dev mode)
  if (configuredSecret) {
    const provided = context.headers.get("x-admin-secret");
    if (provided !== configuredSecret) {
      throw new Error("Unauthorized");
    }
  }

  return next({ context });
});
