import { z } from "zod";
import { publicProcedure } from "../index";
import crypto from "crypto";
import { env } from "../../../env/src/server";

const DIGILOCKER_AUTH_URL = "https://digilocker.meripehchaan.gov.in/public/oauth2/1/authorize";
const DIGILOCKER_TOKEN_URL = "https://digilocker.meripehchaan.gov.in/public/oauth2/1/token";
const DIGILOCKER_USERINFO_URL = "https://digilocker.meripehchaan.gov.in/public/oauth2/1/userinfo";

// Generate DigiLocker authorization URL
export const authRouter = {
  getAuthUrl: publicProcedure
    .input(z.object({ redirectUri: z.string() }))
    .handler(async ({ input }) => {
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
      const aadhaar = userData.aadhaar;
      if (!aadhaar) {
        throw new Error("Aadhaar not found in user data");
      }

      // Generate voter hash from Aadhaar (do not store Aadhaar)
      const salt = crypto.randomBytes(16);
      const voterHash = crypto.createHash("sha256")
        .update(aadhaar + salt.toString("hex"))
        .digest("hex");

      // Check if user exists
      let user = await context.db.user.findUnique({
        where: { voterHash },
      });

      if (!user) {
        user = await context.db.user.create({
          data: {
            voterHash,
          },
        });
      }

      // Generate voter token (signed by backend)
      const tokenDataStr = `${user.voterHash}:${input.electionId}:${Date.now()}`;
      const signature = env.ELECTION_PRIVATE_KEY
        ? crypto.createHmac("sha256", env.ELECTION_PRIVATE_KEY).update(tokenDataStr).digest("hex")
        : "mock-signature"; // Fallback for development

      // Create voter token record
      const voterToken = await context.db.voterToken.create({
        data: {
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