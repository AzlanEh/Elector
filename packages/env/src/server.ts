import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    CORS_ORIGIN: z.url(),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    SOLANA_RPC_URL: z.string().url().default("https://api.devnet.solana.com"),
    ELECTION_PRIVATE_KEY: z.string().optional(), // for signing voter tokens
    ELECTION_ENCRYPTION_KEY: z.string().optional(), // for encrypting votes
    DIGILOCKER_CLIENT_ID: z.string().optional(),
    DIGILOCKER_CLIENT_SECRET: z.string().optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
