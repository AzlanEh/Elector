import { z } from "zod";
import { adminProcedure } from "../index";
import {
  initializeElection as solanaInitElection,
  startElection as solanaStartElection,
  endElection as solanaEndElection,
} from "@elector/blockchain/solana";

/**
 * Admin router — protected by the ADMIN_SECRET env var.
 * Callers must include the header: `x-admin-secret: <ADMIN_SECRET>`.
 * When ADMIN_SECRET is not set the server is in development mode and
 * requests are allowed through without a secret.
 */
export const adminRouter = {
  // Create a new election in the DB and on-chain
  createElection: adminProcedure
    .input(
      z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        startTime: z.string().datetime(),
        endTime: z.string().datetime(),
        candidates: z.array(
          z.object({
            name: z.string().min(1),
            description: z.string().optional(),
          })
        ).min(2),
      })
    )
    .handler(async ({ input, context }) => {
      const startTime = new Date(input.startTime);
      const endTime = new Date(input.endTime);

      if (endTime <= startTime) {
        throw new Error("endTime must be after startTime");
      }

      // Persist to database
      const election = await context.db.election.create({
        data: {
          title: input.title,
          description: input.description,
          startTime,
          endTime,
          candidates: {
            create: input.candidates.map(c => ({
              name: c.name,
              description: c.description,
            })),
          },
        },
        include: { candidates: true },
      });

      // Register on Solana blockchain
      let transactionId: string | null = null;
      try {
        transactionId = await solanaInitElection(
          election.id,
          election.title,
          Math.floor(startTime.getTime() / 1000),
          Math.floor(endTime.getTime() / 1000),
          election.candidates.length
        );

        // Store on-chain program reference
        await context.db.election.update({
          where: { id: election.id },
          data: { solanaProgramId: transactionId },
        });
      } catch (err) {
        console.error("Failed to register election on Solana (recorded in DB):", err);
      }

      return {
        electionId: election.id,
        title: election.title,
        startTime: election.startTime,
        endTime: election.endTime,
        candidates: election.candidates,
        solanaTransactionId: transactionId,
      };
    }),

  // Activate an election (sets isActive = true in DB + calls start_election on Solana)
  startElection: adminProcedure
    .input(z.object({ electionId: z.string() }))
    .handler(async ({ input, context }) => {
      const election = await context.db.election.findUnique({
        where: { id: input.electionId },
      });

      if (!election) throw new Error("Election not found");
      if (election.isActive) throw new Error("Election is already active");

      const now = new Date();
      if (election.startTime > now) {
        throw new Error("Election start time has not been reached yet");
      }

      // Update DB
      await context.db.election.update({
        where: { id: input.electionId },
        data: { isActive: true },
      });

      // Start on Solana
      let transactionId: string | null = null;
      try {
        transactionId = await solanaStartElection(input.electionId);
      } catch (err) {
        console.error("Solana start_election failed (DB updated):", err);
      }

      return { electionId: input.electionId, isActive: true, solanaTransactionId: transactionId };
    }),

  // Close an election (sets isActive = false in DB + calls end_election on Solana)
  endElection: adminProcedure
    .input(z.object({ electionId: z.string() }))
    .handler(async ({ input, context }) => {
      const election = await context.db.election.findUnique({
        where: { id: input.electionId },
      });

      if (!election) throw new Error("Election not found");
      if (!election.isActive) throw new Error("Election is not active");

      // Update DB
      await context.db.election.update({
        where: { id: input.electionId },
        data: { isActive: false },
      });

      // End on Solana
      let transactionId: string | null = null;
      try {
        transactionId = await solanaEndElection(input.electionId);
      } catch (err) {
        console.error("Solana end_election failed (DB updated):", err);
      }

      return { electionId: input.electionId, isActive: false, solanaTransactionId: transactionId };
    }),
};
