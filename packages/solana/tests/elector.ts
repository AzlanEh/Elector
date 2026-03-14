import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import type { Elector } from "../target/types/elector";
import { expect } from "chai";

describe("elector", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace['Elector'] as Program<Elector>;

  it("Initialize election", async () => {
    const electionId = "test-election-001";
    const title = "Test Election";
    const startTime = new anchor.BN(Math.floor(Date.now() / 1000) + 60); // Start in 1 minute
    const endTime = new anchor.BN(startTime.toNumber() + 3600); // End in 1 hour
    const candidateCount = 3;

    // Derive election account address
    const [electionAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("election"), Buffer.from(electionId)],
      program.programId
    );

    console.log("Election account:", electionAccount.toBase58());

    const tx = await program.methods
      .initializeElection(electionId, title, startTime, endTime, candidateCount)
      .accounts({
        election: electionAccount,
        authority: program.provider.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      } as any)
      .rpc();

    console.log("Election initialized successfully!");
    console.log("Transaction:", tx);

    // Fetch and verify election data
    const electionData = await program.account.election.fetch(electionAccount);
    console.log("Election data:", {
      electionId: electionData.electionId,
      title: electionData.title,
      startTime: electionData.startTime.toNumber(),
      endTime: electionData.endTime.toNumber(),
      candidateCount: electionData.candidateCount,
      isActive: electionData.isActive,
      totalVotes: electionData.totalVotes,
      authority: electionData.authority.toBase58(),
    });

    expect(electionData.electionId).to.equal(electionId);
    expect(electionData.title).to.equal(title);
    expect(electionData.candidateCount).to.equal(candidateCount);
    expect(electionData.isActive).to.equal(false);
  });
});
