import { randomBytes, createHash, createCipheriv, createDecipheriv, createHmac } from 'crypto';
import { env } from '@elector/env/server';

// Derive a 32-byte AES key from the env secret (consistent across restarts)
function getEncryptionKey(): Buffer {
  const secret = env.ELECTION_ENCRYPTION_KEY || 'dev-encryption-key-change-in-prod';
  // SHA256 of the secret gives a stable 32-byte key
  return createHash('sha256').update(secret).digest();
}

/**
 * Hash an Aadhaar number into a voter identifier.
 * Uses HMAC-SHA256 with a per-voter random salt so two calls for the same
 * Aadhaar produce different hashes (voter hash is generated once at registration).
 */
export function generateVoterHash(aadhaarId: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = createHmac('sha256', salt).update(aadhaarId).digest('hex');
  return `${hash}:${salt}`; // store both so we can never reverse-engineer Aadhaar
}

/** Generate a random 32-byte hex salt for vote commitments. */
export function generateSalt(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Create a SHA-256 commitment: SHA256(voteData + ":" + salt).
 * This is what goes on-chain — the actual vote remains hidden.
 */
export function createCommitment(voteData: string, salt: string): string {
  return createHash('sha256').update(`${voteData}:${salt}`).digest('hex');
}

/**
 * Encrypt a candidateId with AES-256-GCM.
 * Returns a JSON string containing { encrypted, iv, authTag }.
 * The encrypted payload is stored in the database, never on-chain.
 */
export function encryptVote(candidateId: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(candidateId, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return JSON.stringify({ encrypted, iv: iv.toString('hex'), authTag });
}

/**
 * Decrypt an AES-256-GCM encrypted vote payload.
 * Returns the original candidateId string.
 */
export function decryptVote(encryptedData: string): string {
  const key = getEncryptionKey();
  const { encrypted, iv, authTag } = JSON.parse(encryptedData) as {
    encrypted: string;
    iv: string;
    authTag: string;
  };
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Sign arbitrary token data using HMAC-SHA256 with the ELECTION_PRIVATE_KEY env var.
 * Returns a hex digest.
 */
export function signVoterToken(tokenData: string): string {
  const secret =
    env.ELECTION_PRIVATE_KEY ??
    (env.NODE_ENV !== 'production' ? 'dev-voter-token-secret-change-in-prod' : undefined);
  if (!secret) throw new Error('ELECTION_PRIVATE_KEY is not configured');
  return createHmac('sha256', secret).update(tokenData).digest('hex');
}

/**
 * Verify a voter token signature.
 * Constant-time comparison to avoid timing attacks.
 */
export function verifyVoterTokenSignature(tokenData: string, signature: string): boolean {
  try {
    const expected = signVoterToken(tokenData);
    // Constant-time comparison
    if (expected.length !== signature.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) {
      diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
    }
    return diff === 0;
  } catch {
    return false;
  }
}
