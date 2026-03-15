/**
 * One-shot script: call start_election on devnet for the already-active election.
 * Run with: env $(cat apps/server/.env | grep -v '^#' | xargs) apps/server/node_modules/.bin/tsx scripts/start-election-onchain.ts
 */
import { startElection } from "../packages/blockchain/src/solana.js";

const ELECTION_ID = "cmmqna7kl0008jfm963hy620c";

console.log(`Starting election on devnet: ${ELECTION_ID}`);
try {
  const tx = await startElection(ELECTION_ID);
  console.log("✓ Election started on-chain. Transaction:", tx);
} catch (err: any) {
  if (err?.message?.includes("already started") || err?.logs?.some((l: string) => l.includes("already started"))) {
    console.log("Election already started on-chain — nothing to do.");
  } else {
    console.error("Failed:", err);
    process.exit(1);
  }
}
