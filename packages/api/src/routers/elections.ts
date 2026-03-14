import { z } from "zod";
import { publicProcedure } from "../index";

export const electionsRouter = {
  // Get all active elections
  list: publicProcedure
    .handler(async ({ context }) => {
      const elections = await context.db.election.findMany({
        where: {
          isActive: true,
        },
        include: {
          candidates: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
        },
        orderBy: {
          startTime: 'desc',
        },
      });

      return elections;
    }),

  // Get election by ID with full details
  getById: publicProcedure
    .input(z.object({ electionId: z.string() }))
    .handler(async ({ input, context }) => {
      const election = await context.db.election.findUnique({
        where: { id: input.electionId },
        include: {
          candidates: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
        },
      });

      if (!election) {
        throw new Error("Election not found");
      }

      return election;
    }),

  // Get current active election (assuming single election system)
  getCurrent: publicProcedure
    .handler(async ({ context }) => {
      const now = new Date();
      const election = await context.db.election.findFirst({
        where: {
          isActive: true,
          startTime: { lte: now },
          endTime: { gte: now },
        },
        include: {
          candidates: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
        },
      });

      return election;
    }),
};