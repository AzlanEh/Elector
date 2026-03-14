import { AnchorProvider, Program, web3 } from '@coral-xyz/anchor';
import { PublicKey, Connection, Keypair } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';

import { Elector } from '../target/types/elector';

const PROGRAM_ID = new PublicKey('Elector11111111111111111111111111111112');

export class ElectionClient {
  private program: Program<Elector>;
  private connection: Connection;
  private provider: AnchorProvider;

  constructor(connection: Connection, wallet: Keypair) {
    this.connection = connection;
    this.provider = new AnchorProvider(connection, new anchor.Wallet(wallet), {});
    anchor.setProvider(this.provider);

    // Load the program
    this.program = anchor.workspace.Elector as Program<Elector>;
  }

  // Initialize a new election
  async initializeElection(
    electionId: string,
    title: string,
    startTime: number,
    endTime: number,
    candidateCount: number,
    authority: Keypair
  ): Promise<string> {
    const [electionPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('election'), Buffer.from(electionId)],
      PROGRAM_ID
    );

    const tx = await this.program.methods
      .initializeElection(electionId, title, new anchor.BN(startTime), new anchor.BN(endTime), candidateCount)
      .accounts({
        election: electionPDA,
        authority: authority.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    return tx;
  }

  // Start an election
  async startElection(electionId: string, authority: Keypair): Promise<string> {
    const [electionPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('election'), Buffer.from(electionId)],
      PROGRAM_ID
    );

    const tx = await this.program.methods
      .startElection()
      .accounts({
        election: electionPDA,
        authority: authority.publicKey,
      })
      .signers([authority])
      .rpc();

    return tx;
  }

  // Submit a vote commitment
  async submitVoteCommitment(
    electionId: string,
    voterHash: string,
    commitment: Uint8Array,
    voter: Keypair
  ): Promise<string> {
    const [electionPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('election'), Buffer.from(electionId)],
      PROGRAM_ID
    );

    const [voteCommitmentPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('vote_commitment'), electionPDA.toBuffer(), Buffer.from(voterHash)],
      PROGRAM_ID
    );

    const tx = await this.program.methods
      .submitVoteCommitment(voterHash, Array.from(commitment))
      .accounts({
        election: electionPDA,
        voteCommitment: voteCommitmentPDA,
        voter: voter.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([voter])
      .rpc();

    return tx;
  }

  // End an election
  async endElection(electionId: string, authority: Keypair): Promise<string> {
    const [electionPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('election'), Buffer.from(electionId)],
      PROGRAM_ID
    );

    const tx = await this.program.methods
      .endElection()
      .accounts({
        election: electionPDA,
        authority: authority.publicKey,
      })
      .signers([authority])
      .rpc();

    return tx;
  }

  // Get election data
  async getElection(electionId: string): Promise<any> {
    const [electionPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('election'), Buffer.from(electionId)],
      PROGRAM_ID
    );

    return await this.program.account.election.fetch(electionPDA);
  }

  // Get vote commitment
  async getVoteCommitment(electionId: string, voterHash: string): Promise<any> {
    const [electionPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('election'), Buffer.from(electionId)],
      PROGRAM_ID
    );

    const [voteCommitmentPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('vote_commitment'), electionPDA.toBuffer(), Buffer.from(voterHash)],
      PROGRAM_ID
    );

    return await this.program.account.voteCommitment.fetch(voteCommitmentPDA);
  }
}

// Utility function to create commitment hash
export function createCommitmentHash(voteData: string, salt: string): Uint8Array {
  const crypto = require('crypto');
  const data = `${voteData}:${salt}`;
  const hash = crypto.createHash('sha256').update(data).digest();
  return new Uint8Array(hash);
}

// Generate a new voter wallet (temporary keypair)
export function generateVoterWallet(): Keypair {
  return Keypair.generate();
}