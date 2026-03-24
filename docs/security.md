# Security Notes

This document captures the current authentication model and operational security requirements for Elector.

## Voter Token Model

Voters authenticate by verifying Aadhaar QR via `auth.verifyQR`.

The API returns a signed voter token:

```
<payload-base64url>.<signature-hex>
```

- Payload JSON fields:
  - `userId`: internal user id
  - `iat`: issued-at Unix timestamp (seconds)
  - `exp`: expiry Unix timestamp (seconds)
- Signature:
  - HMAC-SHA256 over `payload-base64url`
  - key: `ELECTION_PRIVATE_KEY`
- Default TTL: 12 hours (`TOKEN_TTL_SECONDS` in `packages/api/src/routers/auth.ts`)

## Transport and Verification

- Client sends token as `Authorization: Bearer <token>`.
- API reads bearer token in `packages/api/src/context.ts`.
- Protected vote endpoints validate token in `packages/api/src/lib/voter-token.ts`:
  - token format
  - HMAC signature
  - payload schema
  - expiry
- If request body also includes a token, it must match the bearer token.

## Production Requirements

Set these variables in production:

- `ELECTION_PRIVATE_KEY` (required)
- `ELECTION_ENCRYPTION_KEY` (required)
- `ADMIN_SECRET` (required if admin endpoints are enabled)
- `CORS_ORIGIN` (must be exact trusted origin)
- `NODE_ENV=production`

Behavior in production:

- Aadhaar `qrData="dev"` bypass is disabled.
- Unverifiable Aadhaar QR signatures are rejected.
- Missing `ELECTION_PRIVATE_KEY` causes token operations to fail.
- Missing `ADMIN_SECRET` blocks `adminProcedure` in production.

## Operational Checklist

- Rotate `ELECTION_PRIVATE_KEY` and `ELECTION_ENCRYPTION_KEY` regularly.
- Keep server logs free of raw Aadhaar QR payloads and token values.
- Use HTTPS end-to-end.
- Apply rate limits on `auth.verifyQR` and `vote.submit` at the edge/API gateway.
- Monitor repeated unauthorized errors and unusual vote bursts.

## Current Scope and Gap Guidance

- Current API routers expose only voter/public routes; no admin mutation routes are wired yet.
- `admin.healthCheck` is now wired behind `adminProcedure` as the baseline protected admin surface.
- Any future election/candidate lifecycle mutation endpoints must use `adminProcedure`.
- Prefer short-lived admin credentials and rotate `ADMIN_SECRET` on deployment boundaries.
