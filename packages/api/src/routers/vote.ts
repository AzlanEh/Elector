import { z } from "zod";
import { publicProcedure } from "../index";
// import { encryptVote, createCommitment, generateSalt } from "@elector/blockchain/crypto";
// import { submitVoteCommitment, generateVoterWallet } from "@elector/blockchain/solana";

export const voteRouter = {
  // Submit a vote
  submit: publicProcedure
    .input(z.object({
      userId: z.string(),
      candidateId: z.string(),
      voterHash: z.string(),
    }))
    .handler(async ({ input, context }) => {
      // Check if user exists and hasn't voted
      const user = await context.db.user.findUnique({
        where: { id: input.userId },
      });

      if (!user) {
        throw new Error("User not found");
      }

      if (user.hasVoted) {
        throw new Error("User has already voted");
      }

      if (user.voterHash !== input.voterHash) {
        throw new Error("Invalid voter hash");
      }

      // Check if candidate exists
      const candidate = await context.db.candidate.findUnique({
        where: { id: input.candidateId },
        include: { election: true },
      });

      if (!candidate) {
        throw new Error("Candidate not found");
      }

      // Check if election is active
      const now = new Date();
      if (!candidate.election.isActive ||
          candidate.election.startTime > now ||
          candidate.election.endTime < now) {
        throw new Error("Election is not active");
      }

      // Encrypt the vote
      const encryptedVote = `encrypted-${input.candidateId}-${Date.now()}`; // TODO: Use crypto

      // Generate salt for commitment
      const salt = `salt-${Date.now()}-${Math.random()}`; // TODO: Use crypto

      // Create cryptographic commitment
      const commitment = `commit-${encryptedVote}-${salt}`; // TODO: Use crypto

      // Store encrypted vote
      await context.db.encryptedVote.create({
        data: {
          voterHash: input.voterHash,
          encryptedVote,
          salt,
        },
      });

      // Create vote commitment (this would be sent to blockchain)
      const voteCommitment = await context.db.voteCommitment.create({
        data: {
          voterHash: input.voterHash,
          commitment,
          electionId: candidate.election.id,
          // transactionId would be set after blockchain transaction
        },
      });

      // Mark user as voted
      await context.db.user.update({
        where: { id: input.userId },
        data: { hasVoted: true },
      });

      // TODO: Submit to Solana blockchain
      // const txId = await submitVoteCommitment(commitment, voterHash);
      // await context.db.voteCommitment.update({
      //   where: { id: voteCommitment.id },
      //   data: { transactionId: txId }
      // });

      return {
        voteCommitmentId: voteCommitment.id,
        commitment,
        timestamp: voteCommitment.timestamp,
      };
    }),

  // Verify a vote commitment exists (for transparency)
  verify: publicProcedure
    .input(z.object({ voterHash: z.string() }))
    .handler(async ({ input, context }) => {
      const commitment = await context.db.voteCommitment.findUnique({
        where: { voterHash: input.voterHash },
        include: {
          election: {
            include: {
              candidates: true,
            },
          },
        },
      });

      if (!commitment) {
        return { exists: false };
      }

      return {
        exists: true,
        commitment: commitment.commitment,
        electionTitle: commitment.election.title,
        timestamp: commitment.timestamp,
        transactionId: commitment.transactionId,
      };
    }),
};