import { Connection, Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import type { Idl } from '@coral-xyz/anchor';
import { readFileSync } from 'fs';
import { homedir } from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from '@elector/env/server';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Solana connection
const connection = new Connection(env.SOLANA_RPC_URL || 'http://127.0.0.1:8899', 'confirmed');

// Election Program ID (deployed on localnet)
export const ELECTION_PROGRAM_ID = new PublicKey('BCjKShjHXdo859DhoWVjbyZgSmC3ecjFzQ8W3BkUeqTr');

// Load wallet
const walletPath = path.join(homedir(), '.config/solana/id.json');
const walletKeypair = Keypair.fromSecretKey(
  new Uint8Array(JSON.parse(readFileSync(walletPath, 'utf8')))
);
const wallet = new anchor.Wallet(walletKeypair);

// Create provider
const provider = new anchor.AnchorProvider(connection, wallet, {
  commitment: 'confirmed',
});
anchor.setProvider(provider);

// Load IDL and create program (Anchor 0.30+ takes only idl + provider; programId is read from IDL)
let _program: anchor.Program | null = null;

function getProgram(): anchor.Program {
  if (!_program) {
    const idlPath = path.join(__dirname, '../../solana/target/idl/elector.json');
    const idl = JSON.parse(readFileSync(idlPath, 'utf8')) as Idl;
    // Anchor ≥0.30: new Program(idl, provider) — programId comes from idl.address
    _program = new anchor.Program(idl, provider);
  }
  return _program;
}

// Generate a temporary wallet for a voter
export function generateVoterWallet(): { publicKey: string; secretKey: Uint8Array } {
  const keypair = Keypair.generate();
  return {
    publicKey: keypair.publicKey.toBase58(),
    secretKey: keypair.secretKey,
  };
}

// Submit vote commitment to Solana blockchain
export async function submitVoteCommitment(
  voterWallet: { publicKey: string; secretKey: Uint8Array },
  commitment: string,
  electionId: string
): Promise<string> {
  const prog = getProgram();
  const voterKeypair = Keypair.fromSecretKey(voterWallet.secretKey);

  // commitment must be exactly 32 bytes (hex string → 64 chars)
  const commitmentBytes = Buffer.from(commitment, 'hex');
  if (commitmentBytes.length !== 32) {
    throw new Error('Commitment must be a 64-char hex string (32 bytes)');
  }

  // Use first 64 chars of voter public key as on-chain voter_hash seed
  const voterHashSeed = voterWallet.publicKey.slice(0, 64);

  // Derive election PDA
  const [electionAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from('election'), Buffer.from(electionId)],
    ELECTION_PROGRAM_ID
  );

  // Derive vote commitment PDA — seeded by election pubkey + voter_hash arg
  const [voteCommitmentAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from('vote_commitment'), electionAccount.toBuffer(), Buffer.from(voterHashSeed)],
    ELECTION_PROGRAM_ID
  );

  const tx = await (prog as any).methods
    .submitVoteCommitment(voterHashSeed, Array.from(commitmentBytes))
    .accounts({
      election: electionAccount,
      voteCommitment: voteCommitmentAccount,
      voter: voterKeypair.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .signers([voterKeypair])
    .rpc();

  return tx;
}

// Verify that a vote commitment exists and matches on the blockchain
export async function verifyVoteCommitment(
  commitment: string,
  electionId: string,
  voterHash: string
): Promise<boolean> {
  try {
    const prog = getProgram();

    const [electionAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from('election'), Buffer.from(electionId)],
      ELECTION_PROGRAM_ID
    );

    const [voteCommitmentAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from('vote_commitment'), electionAccount.toBuffer(), Buffer.from(voterHash)],
      ELECTION_PROGRAM_ID
    );

    const accountInfo = await connection.getAccountInfo(voteCommitmentAccount);
    if (!accountInfo) return false;

    const voteData = await (prog.account as any)['voteCommitment'].fetch(voteCommitmentAccount);
    const storedCommitment = Buffer.from(voteData.commitment as number[]).toString('hex');

    return storedCommitment === commitment;
  } catch {
    return false;
  }
}

// Get election data from the blockchain
export async function getElectionData(electionId: string) {
  const prog = getProgram();

  const [electionAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from('election'), Buffer.from(electionId)],
    ELECTION_PROGRAM_ID
  );

  const electionData = await (prog.account as any)['election'].fetch(electionAccount);

  return {
    id: electionData.electionId as string,
    title: electionData.title as string,
    startTime: (electionData.startTime as anchor.BN).toNumber(),
    endTime: (electionData.endTime as anchor.BN).toNumber(),
    candidateCount: electionData.candidateCount as number,
    isActive: electionData.isActive as boolean,
    totalVotes: electionData.totalVotes as number,
    authority: (electionData.authority as PublicKey).toBase58(),
  };
}

// Initialize election on the blockchain (authority-only)
export async function initializeElection(
  electionId: string,
  title: string,
  startTime: number,
  endTime: number,
  candidateCount: number
): Promise<string> {
  const prog = getProgram();

  const [electionAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from('election'), Buffer.from(electionId)],
    ELECTION_PROGRAM_ID
  );

  const tx = await (prog as any).methods
    .initializeElection(
      electionId,
      title,
      new anchor.BN(startTime),
      new anchor.BN(endTime),
      candidateCount
    )
    .accounts({
      election: electionAccount,
      authority: wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return tx;
}

// Start an election (authority-only)
export async function startElection(electionId: string): Promise<string> {
  const prog = getProgram();

  const [electionAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from('election'), Buffer.from(electionId)],
    ELECTION_PROGRAM_ID
  );

  const tx = await (prog as any).methods
    .startElection()
    .accounts({
      election: electionAccount,
      authority: wallet.publicKey,
    })
    .rpc();

  return tx;
}

// End an election (authority-only)
export async function endElection(electionId: string): Promise<string> {
  const prog = getProgram();

  const [electionAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from('election'), Buffer.from(electionId)],
    ELECTION_PROGRAM_ID
  );

  const tx = await (prog as any).methods
    .endElection()
    .accounts({
      election: electionAccount,
      authority: wallet.publicKey,
    })
    .rpc();

  return tx;
}
