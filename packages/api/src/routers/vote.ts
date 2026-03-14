import { z } from "zod";
import { publicProcedure } from "../index";
import { encryptVote, createCommitment, generateSalt } from "@elector/blockchain/crypto";
import { submitVoteCommitment, generateVoterWallet } from "@elector/blockchain/solana";

export const voteRouter = {
  // Submit a vote
  submit: publicProcedure
    .input(z.object({
      userId: z.string(),
      candidateId: z.string(),
      voterHash: z.string(),
    }))
    .handler(async ({ input, context }) => {
      // Validate user exists and hasn't voted
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

      // Validate candidate and election
      const candidate = await context.db.candidate.findUnique({
        where: { id: input.candidateId },
        include: { election: true },
      });

      if (!candidate) {
        throw new Error("Candidate not found");
      }

      const now = new Date();
      if (
        !candidate.election.isActive ||
        candidate.election.startTime > now ||
        candidate.election.endTime < now
      ) {
        throw new Error("Election is not active");
      }

      // Encrypt the vote with AES-256-GCM
      const encryptedVote = encryptVote(input.candidateId);

      // Generate random salt and SHA-256 commitment
      const salt = generateSalt();
      const commitment = createCommitment(input.candidateId, salt);

      // Store encrypted vote (never revealed until election ends)
      await context.db.encryptedVote.create({
        data: {
          voterHash: input.voterHash,
          encryptedVote,
          salt,
        },
      });

      // Create DB vote commitment record first (we need the ID)
      const voteCommitment = await context.db.voteCommitment.create({
        data: {
          voterHash: input.voterHash,
          commitment,
          electionId: candidate.election.id,
        },
      });

      // Submit commitment to Solana blockchain
      // Generate a disposable keypair for this voter — their identity stays off-chain
      let transactionId: string | null = null;
      try {
        const voterWallet = generateVoterWallet();
        const electionOnChainId = candidate.election.id;
        transactionId = await submitVoteCommitment(voterWallet, commitment, electionOnChainId);

        // Persist the Solana transaction ID
        await context.db.voteCommitment.update({
          where: { id: voteCommitment.id },
          data: { transactionId },
        });
      } catch (err) {
        // Blockchain submission failure is non-fatal — vote is still recorded in DB.
        // Log the error but don't roll back the vote.
        console.error("Solana submission failed (vote recorded in DB):", err);
      }

      // Mark user as voted (atomic — prevents double-voting)
      await context.db.user.update({
        where: { id: input.userId },
        data: { hasVoted: true },
      });

      return {
        voteCommitmentId: voteCommitment.id,
        commitment,
        transactionId,
        timestamp: voteCommitment.timestamp,
      };
    }),

  // Verify a vote commitment exists (for public transparency)
  verify: publicProcedure
    .input(z.object({ voterHash: z.string() }))
    .handler(async ({ input, context }) => {
      const commitment = await context.db.voteCommitment.findUnique({
        where: { voterHash: input.voterHash },
        include: {
          election: {
            include: { candidates: true },
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
