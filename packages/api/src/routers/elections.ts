import { z } from "zod";
import { publicProcedure } from "../index";

export const electionsRouter = {
  list: publicProcedure.handler(async ({ context }) => {
    const elections = await context.db.election.findMany({
      orderBy: { startTime: "desc" },
      include: {
        candidates: {
          select: { id: true, name: true, description: true, party: true },
          orderBy: { createdAt: "asc" },
        },
        _count: { select: { votes: true } },
      },
    });
    return elections;
  }),

  getById: publicProcedure
    .input(z.object({ electionId: z.string() }))
    .handler(async ({ input, context }) => {
      const election = await context.db.election.findUnique({
        where: { id: input.electionId },
        include: {
          candidates: {
            select: { id: true, name: true, description: true, party: true },
            orderBy: { createdAt: "asc" },
          },
          _count: { select: { votes: true } },
        },
      });
      if (!election) throw new Error("Election not found");
      return election;
    }),
};
