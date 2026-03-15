/**
 * One-shot script: initialize the active election PDA on devnet.
 * Run with: node --loader tsx scripts/init-election-onchain.ts
 */
import { initializeElection } from "../packages/blockchain/src/solana.js";

const ELECTION_ID    = "cmmqna7kl0008jfm963hy620c";
const TITLE          = "General Election 2026";
const START_TIME     = Math.floor(new Date("2026-03-01T00:00:00Z").getTime() / 1000);
const END_TIME       = Math.floor(new Date("2026-12-31T23:59:59Z").getTime() / 1000);
const CANDIDATE_COUNT = 3;

console.log(`Initializing election PDA on devnet for: ${ELECTION_ID}`);
try {
  const tx = await initializeElection(ELECTION_ID, TITLE, START_TIME, END_TIME, CANDIDATE_COUNT);
  console.log("✓ Election initialized. Transaction:", tx);
} catch (err: any) {
  // If the account already exists Anchor throws "already in use"
  if (err?.message?.includes("already in use") || err?.logs?.some((l: string) => l.includes("already in use"))) {
    console.log("Election PDA already exists on-chain — nothing to do.");
  } else {
    console.error("Failed:", err);
    process.exit(1);
  }
}
