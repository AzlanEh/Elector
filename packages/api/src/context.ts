import type { Context as HonoContext } from "hono";
import type { PrismaClient } from "@elector/db/client";
import prisma from "@elector/db";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db: PrismaClient =
  globalForPrisma.prisma ??
  prisma;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

export type CreateContextOptions = {
  context: HonoContext;
};

export async function createContext({ context }: CreateContextOptions): Promise<{
  session: null;
  db: PrismaClient;
  getHeader: (name: string) => string | undefined;
  voterToken: string | null;
}> {
  const authHeader = context.req.header("authorization");
  const voterToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim() || null
    : null;

  return {
    session: null,
    db,
    getHeader: (name) => context.req.header(name),
    voterToken,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
