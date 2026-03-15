import { z } from "zod";
import { publicProcedure } from "../index";

export const voteRouter = {
  submit: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        electionId: z.string(),
        candidateId: z.string(),
      })
    )
    .handler(async ({ input, context }) => {
      // Verify election is currently active
      const election = await context.db.election.findUnique({
        where: { id: input.electionId },
      });
      if (!election) throw new Error("Election not found");

      const now = new Date();
      if (now < election.startTime) throw new Error("Election has not started yet");
      if (now > election.endTime) throw new Error("Election has ended");

      // Verify candidate belongs to this election
      const candidate = await context.db.candidate.findFirst({
        where: { id: input.candidateId, electionId: input.electionId },
      });
      if (!candidate) throw new Error("Candidate not found in this election");

      // Check if user already voted in this election
      const existing = await context.db.vote.findUnique({
        where: {
          userId_electionId: {
            userId: input.userId,
            electionId: input.electionId,
          },
        },
      });
      if (existing) throw new Error("You have already voted in this election");

      const vote = await context.db.vote.create({
        data: {
          userId: input.userId,
          electionId: input.electionId,
          candidateId: input.candidateId,
        },
      });

      return { success: true, voteId: vote.id };
    }),

  hasVoted: publicProcedure
    .input(z.object({ userId: z.string(), electionId: z.string() }))
    .handler(async ({ input, context }) => {
      const vote = await context.db.vote.findUnique({
        where: {
          userId_electionId: {
            userId: input.userId,
            electionId: input.electionId,
          },
        },
        select: { candidateId: true },
      });
      return { hasVoted: !!vote, votedCandidateId: vote?.candidateId ?? null };
    }),
};
