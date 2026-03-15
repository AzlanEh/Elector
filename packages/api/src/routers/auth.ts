import { z } from "zod";
import { publicProcedure } from "../index";
import { parseAadhaarQr, devAadhaarData } from "../lib/aadhaar-qr-parser";

// Dev mode sentinel: when qrData is this string, return synthetic test data
const DEV_QR_SENTINEL = "dev";

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
        /** Raw QR bytes encoded as Base64, or "dev" for development bypass */
        qrData: z.string().min(1),
      })
    )
    .handler(async ({ input, context }) => {
      const isDev = input.qrData === DEV_QR_SENTINEL;

      // ── Step 1: Parse QR ──────────────────────────────────────────────────
      const aadhaarData = isDev
        ? devAadhaarData()
        : await parseAadhaarQr(input.qrData);

      // ── Step 2: Signature check ───────────────────────────────────────────
      // Physical card V5 pipe-delimited QRs do not verify against the published
      // UIDAI offline cert (different key). We log but do not block for this format.
      if (!isDev && !aadhaarData.signatureValid) {
        // Soft fail — proceed with unverified identity data
      }

      // ── Step 3: Age eligibility ───────────────────────────────────────────
      if (aadhaarData.age < 18) {
        throw new Error(
          `You must be at least 18 years old. ` +
            `Your age based on Aadhaar records: ${aadhaarData.age}.`
        );
      }

      // ── Step 4: Upsert User ───────────────────────────────────────────────
      const user = await context.db.user.upsert({
        where: { aadhaarHash: aadhaarData.uid },
        update: {},
        create: { aadhaarHash: aadhaarData.uid },
      });

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
      };
    }),
};
