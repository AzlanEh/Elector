import { Connection, Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import type { Idl } from '@coral-xyz/anchor';

// @coral-xyz/anchor is a CJS package — BN lives on the default export when
// imported as a namespace in ESM.
const BN = (anchor as any).default?.BN ?? (anchor as any).BN;
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

/**
 * Fund a voter keypair with enough SOL to cover rent for one VoteCommitment PDA.
 * Uses a SOL transfer from the authority wallet — works on localnet, devnet, and
 * mainnet without hitting the airdrop faucet rate limit.
 */
async function fundVoterWallet(pubkey: PublicKey): Promise<void> {
  // VoteCommitment account size: 8 (discriminator) + 4+64 (voter_hash) + 32 + 8 = 116 bytes
  // Minimum rent-exempt balance for 116 bytes is ~0.0016 SOL; send 0.01 for headroom.
  const lamports = 10_000_000; // 0.01 SOL

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  const tx = new anchor.web3.Transaction({
    recentBlockhash: blockhash,
    feePayer: walletKeypair.publicKey,
  }).add(
    SystemProgram.transfer({
      fromPubkey: walletKeypair.publicKey,
      toPubkey: pubkey,
      lamports,
    })
  );

  const sig = await provider.sendAndConfirm(tx, [], { commitment: 'confirmed' });
  await connection.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    'confirmed'
  );
}

// Submit vote commitment to Solana blockchain
export async function submitVoteCommitment(
  voterWallet: { publicKey: string; secretKey: Uint8Array },
  commitment: string,
  electionId: string
): Promise<string> {
  const prog = getProgram();
  const voterKeypair = Keypair.fromSecretKey(voterWallet.secretKey);

  // Fund the disposable voter keypair so it can pay for PDA rent
  await fundVoterWallet(voterKeypair.publicKey);

  // commitment must be exactly 32 bytes (hex string → 64 chars)
  const commitmentBytes = Buffer.from(commitment, 'hex');
  if (commitmentBytes.length !== 32) {
    throw new Error('Commitment must be a 64-char hex string (32 bytes)');
  }

  // Derive election PDA
  const [electionAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from('election'), Buffer.from(electionId)],
    ELECTION_PROGRAM_ID
  );

  // Derive vote commitment PDA — seeded by election pubkey + voter pubkey (32 bytes each)
  const [voteCommitmentAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from('vote_commitment'), electionAccount.toBuffer(), voterKeypair.publicKey.toBuffer()],
    ELECTION_PROGRAM_ID
  );

  // Pass the voter pubkey as the voter_hash string arg (human-readable id on-chain)
  const voterHashArg = voterKeypair.publicKey.toBase58();

  const tx = await (prog as any).methods
    .submitVoteCommitment(voterHashArg, Array.from(commitmentBytes))
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
  _voterHash: string
): Promise<boolean> {
  try {
    const prog = getProgram();

    const [electionAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from('election'), Buffer.from(electionId)],
      ELECTION_PROGRAM_ID
    );

    // voterHash is a 64-char hex string (32 bytes raw). The vote_commitment PDA is
    // seeded by the voter keypair pubkey (not the hash string), so we can't reverse-
    // lookup the PDA from the hash alone without storing the voter pubkey. For now,
    // enumerate all VoteCommitment accounts for the election using getProgramAccounts.
    // This is a read-only best-effort check — failures return false gracefully.
    const accounts = await connection.getProgramAccounts(ELECTION_PROGRAM_ID, {
      filters: [
        { memcmp: { offset: 0, bytes: electionAccount.toBase58() } },
      ],
    });

    for (const { account } of accounts) {
      try {
        const voteData = await (prog.account as any)['voteCommitment'].coder.accounts.decode(
          'voteCommitment', account.data
        );
        const storedCommitment = Buffer.from(voteData.commitment as number[]).toString('hex');
        if (storedCommitment === commitment) return true;
      } catch {
        // not a voteCommitment account, skip
      }
    }

    return false;
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
      new BN(startTime),
      new BN(endTime),
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
