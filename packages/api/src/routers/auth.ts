import { z } from "zod";
import { createHash, createHmac } from "node:crypto";
import { env } from "@elector/env/server";
import { signVoterToken } from "@elector/blockchain";
import { publicProcedure } from "../index";
import { parseAadhaarQr, devAadhaarData } from "../lib/aadhaar-qr-parser";
import { unauthorized } from "../lib/errors";

// Dev mode sentinel: when qrData is this string, return synthetic test data
const DEV_QR_SENTINEL = "dev";

const TOKEN_TTL_SECONDS = 60 * 60 * 12; // 12 hours

function deriveIdentityKey(input: {
  uid: string;
  name: string;
  dob: string;
  gender: string;
  address: string;
  pincode?: string;
}): string {
  const canonical = [
    input.uid,
    input.name,
    input.dob,
    input.gender,
    input.address,
    input.pincode ?? "",
  ]
    .map((value) => value.trim().toLowerCase().replace(/\s+/g, " "))
    .join("|");

  if (env.ELECTION_PRIVATE_KEY) {
    return createHmac("sha256", env.ELECTION_PRIVATE_KEY).update(canonical).digest("hex");
  }

  if (env.NODE_ENV === "production") {
    throw new Error("Server misconfigured: ELECTION_PRIVATE_KEY is required in production");
  }

  return createHash("sha256").update(canonical).digest("hex");
}

function issueVoterToken(userId: string): string {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + TOKEN_TTL_SECONDS;
  const payload = Buffer.from(JSON.stringify({ userId, iat, exp })).toString("base64url");
  const signature = signVoterToken(payload);
  return `${payload}.${signature}`;
}

export const authRouter = {
  /**
   * Verify an Aadhaar QR code and return the parsed identity.
   *
   * The native app scans the Aadhaar Secure QR, encodes the raw bytes as
   * Base64, and sends it here. The server:
   *   1. Parses the QR payload (handles both Secure QR and legacy formats)
   *   2. Checks age eligibility (>= 18)
   *   3. Upserts the User record
   *   4. Returns display fields (name, dob, photo) — UID is discarded
   *
   * Dev mode: pass qrData = "dev" to receive synthetic data without scanning.
   */
  verifyQR: publicProcedure
    .input(
      z.object({
        /** Raw QR bytes encoded as Base64, or "dev" in non-production */
        qrData: z.string().min(1),
      })
    )
    .handler(async ({ input, context }) => {
      const isDevSentinel = input.qrData === DEV_QR_SENTINEL;
      const isDev = env.NODE_ENV !== "production" && isDevSentinel;

      if (env.NODE_ENV === "production" && isDevSentinel) {
        unauthorized();
      }

      // ── Step 1: Parse QR ──────────────────────────────────────────────────
      const aadhaarData = isDev
        ? devAadhaarData()
        : await parseAadhaarQr(input.qrData);

      // ── Step 2: Signature check ───────────────────────────────────────────
      if (!isDev && !aadhaarData.signatureValid && env.NODE_ENV === "production") {
        unauthorized();
      }

      // ── Step 3: Age eligibility ───────────────────────────────────────────
      if (aadhaarData.age < 18) {
        throw new Error(
          `You must be at least 18 years old. ` +
            `Your age based on Aadhaar records: ${aadhaarData.age}.`
        );
      }

      // ── Step 4: Upsert User ───────────────────────────────────────────────
      const identityKey = deriveIdentityKey({
        uid: aadhaarData.uid,
        name: aadhaarData.name,
        dob: aadhaarData.dob,
        gender: aadhaarData.gender,
        address: aadhaarData.address,
        pincode: aadhaarData.pincode,
      });

      const user = await context.db.user.upsert({
        where: { aadhaarHash: identityKey },
        update: {},
        create: { aadhaarHash: identityKey },
      });

      const voterToken = issueVoterToken(user.id);

      // ── Step 5: Return — UID never leaves this function ───────────────────
      return {
        userId: user.id,
        // Display fields for the identity confirmation card in the native app
        displayName: aadhaarData.name,
        dob: aadhaarData.dob,
        age: aadhaarData.age,
        gender: aadhaarData.gender,
        /** Base64-encoded JPEG photo, or null if not present in QR */
        photo: aadhaarData.photo ?? null,
        signatureValid: aadhaarData.signatureValid,
        qrFormat: aadhaarData.format,
        voterToken,
      };
    }),
};
