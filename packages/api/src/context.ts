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

export async function createContext({ }: CreateContextOptions): Promise<{
  session: null;
  db: PrismaClient;
}> {
  // No auth configured
  return {
    session: null,
    db,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
