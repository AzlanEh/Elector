# Vercel Deployment (Monorepo)

This project deploys the API as a Vercel serverless function through `api/index.ts` and the shared Hono app in `apps/server/src/app.ts`.

## Required Repository Files

- `vercel.json` (repo root)
- `api/index.ts` (Vercel function entry)

## Vercel Project Setup

Create one Vercel project pointing to this repository.

- Framework preset: `Other`
- Root directory: repository root
- Install command: `pnpm install --frozen-lockfile`
- Build command: `pnpm -F server build`

Routing is handled by `vercel.json` rewrite:

- `/(.*)` -> `/api`

This means requests like `/rpc/...` and `/api-reference/...` are forwarded to the Hono app function.

## Required Environment Variables

Set these in Vercel Project Settings -> Environment Variables:

- `DATABASE_URL`
- `CORS_ORIGIN`
- `NODE_ENV=production`
- `SOLANA_RPC_URL`
- `ELECTION_PRIVATE_KEY`
- `ELECTION_ENCRYPTION_KEY`

If/when admin mutation routes are used, also set:

- `ADMIN_SECRET`

## Post-Deploy Smoke Checks

After deploy, verify:

1. `GET /` returns `OK`
2. `POST /rpc/healthCheck` works from your client
3. `POST /rpc/admin/healthCheck` returns unauthorized without `x-admin-secret`
4. CORS only allows your configured origin

To call the admin health check with secret:

```bash
curl -X POST "$DEPLOY_URL/rpc/admin/healthCheck" \
  -H "content-type: application/json" \
  -H "x-admin-secret: $ADMIN_SECRET" \
  -d "{}"
```

## Security Notes

- Never commit secrets to the repository.
- Rotate `ELECTION_PRIVATE_KEY` and `ELECTION_ENCRYPTION_KEY` periodically.
- Keep `CORS_ORIGIN` strict (no wildcard in production).
