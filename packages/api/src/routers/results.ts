import { z } from "zod";
import { publicProcedure } from "../index";
import { decryptVote } from "@elector/blockchain/crypto";

export const resultsRouter = {
  // Get results for a completed election (decrypts all votes)
  getElectionResults: publicProcedure
    .input(z.object({ electionId: z.string() }))
    .handler(async ({ input, context }) => {
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

      // Fetch all encrypted votes for this election's voters
      const voterHashes = election.voteCommitments.map(vc => vc.voterHash);
      const encryptedVotes = await context.db.encryptedVote.findMany({
        where: { voterHash: { in: voterHashes } },
      });

      // Tally votes by decrypting each one
      const voteCounts = new Map<string, number>();
      for (const candidate of election.candidates) {
        voteCounts.set(candidate.id, 0);
      }

      let decryptionErrors = 0;
      for (const ev of encryptedVotes) {
        try {
          const candidateId = decryptVote(ev.encryptedVote);
          if (voteCounts.has(candidateId)) {
            voteCounts.set(candidateId, (voteCounts.get(candidateId) ?? 0) + 1);
          }
        } catch {
          // Corrupted or tampered ciphertext — skip and count
          decryptionErrors++;
        }
      }

      const results = election.candidates.map(candidate => ({
        candidateId: candidate.id,
        candidateName: candidate.name,
        voteCount: voteCounts.get(candidate.id) ?? 0,
      }));

      // Sort by vote count descending
      results.sort((a, b) => b.voteCount - a.voteCount);

      return {
        electionId: election.id,
        electionTitle: election.title,
        endTime: election.endTime,
        totalCommitments: election.voteCommitments.length,
        totalDecrypted: encryptedVotes.length - decryptionErrors,
        decryptionErrors,
        results,
      };
    }),

  // Get all elections (active and completed) with results
  getAllResults: publicProcedure
    .handler(async ({ context }) => {
      const elections = await context.db.election.findMany({
        include: {
          candidates: true,
          voteCommitments: true,
        },
        orderBy: { endTime: "desc" },
      });

      const allResults = await Promise.all(
        elections.map(async election => {
          const voterHashes = election.voteCommitments.map(vc => vc.voterHash);
          const encryptedVotes = await context.db.encryptedVote.findMany({
            where: { voterHash: { in: voterHashes } },
          });

          const voteCounts = new Map<string, number>();
          for (const candidate of election.candidates) {
            voteCounts.set(candidate.id, 0);
          }

          for (const ev of encryptedVotes) {
            try {
              const candidateId = decryptVote(ev.encryptedVote);
              if (voteCounts.has(candidateId)) {
                voteCounts.set(candidateId, (voteCounts.get(candidateId) ?? 0) + 1);
              }
            } catch {
              // skip corrupted votes
            }
          }

          const results = election.candidates.map(candidate => ({
            candidateId: candidate.id,
            candidateName: candidate.name,
            voteCount: voteCounts.get(candidate.id) ?? 0,
          }));
          results.sort((a, b) => b.voteCount - a.voteCount);

          return {
            electionId: election.id,
            electionTitle: election.title,
            endTime: election.endTime,
            totalCommitments: election.voteCommitments.length,
            results,
          };
        })
      );

      return allResults;
    }),

  // Get public vote commitments for a given election (for transparency/auditing)
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
        orderBy: { timestamp: "asc" },
      });

      return {
        electionId: input.electionId,
        commitments,
        total: commitments.length,
      };
    }),
};
