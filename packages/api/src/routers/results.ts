import { z } from "zod";
import { publicProcedure } from "../index";

export const resultsRouter = {
  // Get results for an election
  getElectionResults: publicProcedure
    .input(z.object({ electionId: z.string() }))
    .handler(async ({ input, context }) => {
      // Check if election exists and has ended
      const election = await context.db.election.findUnique({
        where: { id: input.electionId },
        include: {
          candidates: true,
          voteCommitments: true,
        },
      });

      if (!election) {
        throw new Error("Election not found");
      }

      const now = new Date();
      if (election.endTime > now) {
        throw new Error("Election has not ended yet");
      }

      // For now, we can only show vote counts (encrypted votes can't be decrypted yet)
      const results = election.candidates.map(candidate => ({
        candidateId: candidate.id,
        candidateName: candidate.name,
        voteCount: 0, // Would be calculated after decryption
      }));

      // Sort by candidate name for now
      results.sort((a, b) => a.candidateName.localeCompare(b.candidateName));

      return {
        electionId: election.id,
        electionTitle: election.title,
        endTime: election.endTime,
        totalCommitments: election.voteCommitments.length,
        results,
        note: "Results will be available after vote decryption phase",
      };
    }),

  // Get all completed elections with results
  getAllResults: publicProcedure
    .handler(async ({ context }) => {
      const now = new Date();

      const elections = await context.db.election.findMany({
        where: {
          endTime: { lt: now },
        },
        include: {
          candidates: true,
          voteCommitments: true,
        },
        orderBy: {
          endTime: 'desc',
        },
      });

      const results = elections.map(election => {
        const electionResults = election.candidates.map(candidate => ({
          candidateId: candidate.id,
          candidateName: candidate.name,
          voteCount: 0, // Would be calculated after decryption
        }));

        electionResults.sort((a, b) => a.candidateName.localeCompare(b.candidateName));

        return {
          electionId: election.id,
          electionTitle: election.title,
          endTime: election.endTime,
          totalCommitments: election.voteCommitments.length,
          results: electionResults,
          note: "Results will be available after vote decryption phase",
        };
      });

      return results;
    }),

  // Get vote commitments for transparency
  getVoteCommitments: publicProcedure
    .input(z.object({ electionId: z.string() }))
    .handler(async ({ input, context }) => {
      const commitments = await context.db.voteCommitment.findMany({
        where: { electionId: input.electionId },
        select: {
          voterHash: true,
          commitment: true,
          timestamp: true,
          transactionId: true,
        },
        orderBy: {
          timestamp: 'asc',
        },
      });

      return {
        electionId: input.electionId,
        commitments,
        total: commitments.length,
      };
    }),
};