import { z } from "zod";
import { publicProcedure } from "../index";
import crypto from "crypto";
import { env } from "@elector/env/server";

const DIGILOCKER_AUTH_URL = "https://digilocker.meripehchaan.gov.in/public/oauth2/1/authorize";
const DIGILOCKER_TOKEN_URL = "https://digilocker.meripehchaan.gov.in/public/oauth2/1/token";
const DIGILOCKER_USERINFO_URL = "https://digilocker.meripehchaan.gov.in/public/oauth2/1/userinfo";

// Dev mode: when DigiLocker credentials are absent, use a fixed test Aadhaar
const DEV_AADHAAR = "999999999999";
const DEV_AUTH_CODE = "dev";

// Generate DigiLocker authorization URL
export const authRouter = {
  getAuthUrl: publicProcedure
    .input(z.object({ redirectUri: z.string() }))
    .handler(async ({ input }) => {
      // Dev mode: no DigiLocker credentials configured — return a synthetic deep link
      // that the native app can handle directly without a real OAuth round-trip.
      if (!env.DIGILOCKER_CLIENT_ID) {
        // Build the deep-link the app is already listening on, but with code=dev
        // so auth.callback knows to skip the token exchange.
        const redirectUri = input.redirectUri;
        const devCallbackUrl = `${redirectUri}?code=${DEV_AUTH_CODE}&state=dev`;
        return {
          authUrl: devCallbackUrl,
          state: "dev",
        };
      }

      const params = new URLSearchParams({
        response_type: "code",
        client_id: env.DIGILOCKER_CLIENT_ID,
        redirect_uri: input.redirectUri,
        scope: "openid",
        state: crypto.randomBytes(16).toString("hex"), // CSRF protection
      });

      return {
        authUrl: `${DIGILOCKER_AUTH_URL}?${params.toString()}`,
        state: params.get("state"),
      };
    }),

  // Handle DigiLocker callback
  callback: publicProcedure
    .input(z.object({
      code: z.string(),
      redirectUri: z.string(),
      electionId: z.string().optional().default("sample-election-1"),
    }))
    .handler(async ({ input, context }) => {
      let aadhaar: string;

      if (input.code === DEV_AUTH_CODE) {
        // Dev mode bypass: skip OAuth token exchange and use a fixed test Aadhaar
        aadhaar = DEV_AADHAAR;
      } else {
        if (!env.DIGILOCKER_CLIENT_ID || !env.DIGILOCKER_CLIENT_SECRET) {
          throw new Error("DigiLocker credentials are not configured");
        }

        // Exchange code for access token
        const tokenResponse = await fetch(DIGILOCKER_TOKEN_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code: input.code,
            client_id: env.DIGILOCKER_CLIENT_ID,
            client_secret: env.DIGILOCKER_CLIENT_SECRET,
            redirect_uri: input.redirectUri,
          }).toString(),
        });

        if (!tokenResponse.ok) {
          throw new Error("Failed to exchange code for token");
        }

        const tokenData = await tokenResponse.json() as any;
        const accessToken = tokenData.access_token;

        // Get user info
        const userResponse = await fetch(DIGILOCKER_USERINFO_URL, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!userResponse.ok) {
          throw new Error("Failed to get user info");
        }

        const userData = await userResponse.json() as any;

        // Extract Aadhaar number (assuming it's in userData.aadhaar)
        aadhaar = userData.aadhaar;
        if (!aadhaar) {
          throw new Error("Aadhaar not found in user data");
        }
      }

      // Generate a deterministic voter hash from Aadhaar using HMAC-SHA256.
      // The ELECTION_PRIVATE_KEY acts as the keying material so the hash cannot
      // be brute-forced without the server secret. Aadhaar is never stored.
      const hmacKey = env.ELECTION_PRIVATE_KEY ?? "dev-voter-hash-key-change-in-prod";
      const voterHash = crypto.createHmac("sha256", hmacKey)
        .update(aadhaar)
        .digest("hex");

      // In dev mode, reset hasVoted so the same test Aadhaar can vote again each session.
      // In production (real DigiLocker credentials), hasVoted is permanent.
      const isDev = input.code === DEV_AUTH_CODE;

      // Upsert user — create on first login, reset hasVoted in dev mode on re-login
      const user = await context.db.user.upsert({
        where: { voterHash },
        update: isDev ? { hasVoted: false } : {},
        create: { voterHash },
      });

      // In dev mode, clean up prior vote records so the user can vote again
      if (isDev) {
        await context.db.voteCommitment.deleteMany({ where: { voterHash } });
        await context.db.encryptedVote.deleteMany({ where: { voterHash } });
      }

      // Generate voter token (signed by backend)
      const tokenDataStr = `${user.voterHash}:${input.electionId}:${Date.now()}`;
      const signature = env.ELECTION_PRIVATE_KEY
        ? crypto.createHmac("sha256", env.ELECTION_PRIVATE_KEY).update(tokenDataStr).digest("hex")
        : "dev-signature"; // Fallback for development

      // Upsert voter token — re-authenticating refreshes the expiry rather than failing
      const voterToken = await context.db.voterToken.upsert({
        where: { voterHash: user.voterHash },
        update: {
          electionId: input.electionId,
          signature,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        },
        create: {
          voterHash: user.voterHash,
          electionId: input.electionId,
          signature,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        },
      });

      return {
        userId: user.id,
        voterHash: user.voterHash,
        hasVoted: user.hasVoted,
        voterToken: {
          id: voterToken.id,
          signature: voterToken.signature,
          expiresAt: voterToken.expiresAt,
        },
      };
    }),

  // Get user status
  getUser: publicProcedure
    .input(z.object({ userId: z.string() }))
    .handler(async ({ input, context }) => {
      const user = await context.db.user.findUnique({
        where: { id: input.userId },
        select: {
          id: true,
          voterHash: true,
          hasVoted: true,
        },
      });

      if (!user) {
        throw new Error("User not found");
      }

      return user;
    }),

  // Verify voter token
  verifyToken: publicProcedure
    .input(z.object({ voterHash: z.string(), signature: z.string() }))
    .handler(async ({ input, context }) => {
      const token = await context.db.voterToken.findFirst({
        where: {
          voterHash: input.voterHash,
          signature: input.signature,
          expiresAt: { gt: new Date() },
        },
      });

      return { valid: !!token };
    }),
};