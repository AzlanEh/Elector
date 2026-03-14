import { randomBytes } from 'crypto';
import { env } from '@elector/env/server';

// Generate voter hash from Aadhaar + salt (do not include election ID to allow cross-election)
export async function generateVoterHash(aadhaarId: string): Promise<string> {
  const crypto = await import('crypto');
  const salt = randomBytes(16);
  const data = aadhaarId + salt.toString('hex');
  const hash = crypto.createHash('sha256').update(data).digest('hex');
  return hash;
}

// Generate random salt for commitments
export function generateSalt(): string {
  return randomBytes(32).toString('hex');
}

// Create cryptographic commitment
export async function createCommitment(voteData: string, salt: string): Promise<string> {
  const crypto = await import('crypto');
  const data = `${voteData}:${salt}`;
  const hash = crypto.createHash('sha256').update(data).digest('hex');
  return hash;
}

// Encrypt vote using AES-GCM
export async function encryptVote(candidateId: string): Promise<string> {
  const crypto = await import('crypto');
  const algorithm = 'aes-256-gcm';
  const key = Buffer.from((env.ELECTION_ENCRYPTION_KEY || 'default-dev-key-32-chars-long').padEnd(32, ' ').slice(0, 32));
  const iv = randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(candidateId, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return JSON.stringify({
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  });
}

// Decrypt vote using AES-GCM
export async function decryptVote(encryptedData: string): Promise<string> {
  const crypto = await import('crypto');
  const algorithm = 'aes-256-gcm';
  const key = Buffer.from((env.ELECTION_ENCRYPTION_KEY || 'default-dev-key-32-chars-long').padEnd(32, ' ').slice(0, 32));
  const { encrypted, iv, authTag } = JSON.parse(encryptedData);
  const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Sign voter token with backend private key
export async function signVoterToken(tokenData: string): Promise<string> {
  const crypto = await import('crypto');
  const privateKey = env.ELECTION_PRIVATE_KEY;
  if (!privateKey) throw new Error('ELECTION_PRIVATE_KEY not set');
  const sign = crypto.createSign('SHA256');
  sign.update(tokenData);
  return sign.sign(privateKey, 'hex');
}

// Verify voter token signature
export async function verifyVoterToken(): Promise<boolean> {
  // Mock verification - in production, implement proper verification
  return true;
}