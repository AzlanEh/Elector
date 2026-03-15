import { z } from "zod";
import { publicProcedure } from "../index";

export const resultsRouter = {
  getByElection: publicProcedure
    .input(z.object({ electionId: z.string() }))
    .handler(async ({ input, context }) => {
      const candidates = await context.db.candidate.findMany({
        where: { electionId: input.electionId },
        include: { _count: { select: { votes: true } } },
        orderBy: { createdAt: "asc" },
      });

      const totalVotes = candidates.reduce((sum, c) => sum + c._count.votes, 0);

      const results = candidates
        .map((c) => ({
          candidateId: c.id,
          candidateName: c.name,
          party: c.party ?? null,
          voteCount: c._count.votes,
          percentage:
            totalVotes > 0
              ? Math.round((c._count.votes / totalVotes) * 100)
              : 0,
        }))
        .sort((a, b) => b.voteCount - a.voteCount);

      return { electionId: input.electionId, totalVotes, results };
    }),
};
