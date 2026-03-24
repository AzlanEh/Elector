import { verifyVoterTokenSignature } from "@elector/blockchain";
import { z } from "zod";
import { unauthorized } from "./errors";

const voterTokenClaimsSchema = z.object({
  userId: z.string().min(1),
  iat: z.number().int(),
  exp: z.number().int(),
});

export function getAuthenticatedUserId(inputToken: string | undefined, headerToken: string | null): string {
  if (inputToken && headerToken && inputToken !== headerToken) {
    unauthorized();
  }

  const token = headerToken ?? inputToken;
  if (!token) unauthorized();

  const [payload, signature] = token.split(".");
  if (!payload || !signature) unauthorized();

  if (!verifyVoterTokenSignature(payload, signature)) {
    unauthorized();
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    unauthorized();
  }

  const parsed = voterTokenClaimsSchema.safeParse(decoded);
  if (!parsed.success) unauthorized();

  const now = Math.floor(Date.now() / 1000);
  if (parsed.data.exp <= now) unauthorized();

  return parsed.data.userId;
}
