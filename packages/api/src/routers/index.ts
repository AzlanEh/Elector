import type { RouterClient } from "@orpc/server";

import { publicProcedure } from "../index";
import { adminRouter } from "./admin";
import { authRouter } from "./auth";
import { electionsRouter } from "./elections";
import { resultsRouter } from "./results";
import { voteRouter } from "./vote";

export const appRouter = {
  healthCheck: publicProcedure.handler(() => {
    return "OK";
  }),
  auth: authRouter,
  elections: electionsRouter,
  results: resultsRouter,
  vote: voteRouter,
  admin: adminRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
