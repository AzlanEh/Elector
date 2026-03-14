import { AnchorProvider, Program, web3, BN } from '@coral-xyz/anchor';
import { PublicKey, Connection, Keypair } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import type { Elector } from '../../target/types/elector';

const PROGRAM_ID = new PublicKey('BCjKShjHXdo859DhoWVjbyZgSmC3ecjFzQ8W3BkUeqTr');

export class ElectionClient {
  private program: Program<Elector>;
  private provider: AnchorProvider;

  constructor(connection: Connection, wallet: Keypair) {
    this.provider = new AnchorProvider(connection, new anchor.Wallet(wallet), {});
    anchor.setProvider(this.provider);
    this.program = anchor.workspace['Elector'] as Program<Elector>;
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
      .initializeElection(electionId, title, new BN(startTime), new BN(endTime), candidateCount)
      .accounts({
        election: electionPDA,
        authority: authority.publicKey,
        systemProgram: web3.SystemProgram.programId,
      } as any)
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
      } as any)
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
      } as any)
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
      } as any)
      .signers([authority])
      .rpc();

    return tx;
  }

  // Get election data
  async getElection(electionId: string): Promise<unknown> {
    const [electionPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('election'), Buffer.from(electionId)],
      PROGRAM_ID
    );

    return await this.program.account.election.fetch(electionPDA);
  }

  // Get vote commitment
  async getVoteCommitment(electionId: string, voterHash: string): Promise<unknown> {
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
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require('crypto') as typeof import('crypto');
  const data = `${voteData}:${salt}`;
  const hash = crypto.createHash('sha256').update(data).digest();
  return new Uint8Array(hash);
}

// Generate a new voter wallet (temporary keypair)
export function generateVoterWallet(): Keypair {
  return Keypair.generate();
}
