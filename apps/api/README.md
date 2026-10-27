# LinkHub API

Express 5 API for LinkHub v2.4. It serves the JSON API consumed by the Next.js
web app in `apps/web` and is the only process that talks to PostgreSQL.

- **Runtime:** Node.js 22, TypeScript, Express 5
- **Data:** PostgreSQL 16 (Neon in production) through Prisma 6
- **Sessions:** `express-session` + `connect-pg-simple` (`lh.sid`, HttpOnly)
- **Passwords:** argon2id
- **Validation:** Zod 4 schemas in each module plus `@linkhub/shared`
- **Jobs:** a standalone nightly analytics/prune script
- **Spec:** `link-hub-architecture.md` (§6 API design, §8 schema, §14 export,
  §15 observability)

## Local setup

Prerequisites: Node 22, pnpm 11, Docker Desktop (or any PostgreSQL 16 server).

```bash
pnpm install

# 1. Create the environment file at the repository root.
cp .env.example .env
# Edit at least DATABASE_URL, DIRECT_URL, SESSION_SECRET,
# ANALYTICS_HASH_SECRET, REVALIDATE_SECRET, INTERNAL_FETCH_TOKEN and
# WEB_PROXY_SECRET. Secrets must be at least 32 characters.

# 2. Start PostgreSQL (example uses Docker on port 5434).
docker run -d --name linkhub-postgres \
  -e POSTGRES_USER=linkhub -e POSTGRES_PASSWORD=linkhub -e POSTGRES_DB=linkhub \
  -p 5434:5432 postgres:16-alpine

# 3. Apply the schema and seed the owner account.
pnpm db:deploy
pnpm db:seed

# 4. Run the API.
pnpm api:dev            # http://localhost:4000
```

`apps/api/src/config/env.ts` loads the repository-root `.env` automatically, so
commands work from the repo root or from `apps/api`. Platform deployments should
set real environment variables instead of shipping a file.

The seed creates the owner from `SEED_OWNER_EMAIL`, `SEED_OWNER_PASSWORD` and
`SEED_OWNER_NAME`. It is idempotent and only runs when the owner does not exist.

### Web app

The web app calls same-origin `/api/*`, rewritten to this API. Set:

- `API_BASE_URL=http://localhost:4000` for server-side fetches
- `APP_URL` to the web origin (the API uses it for Origin/CSRF checks)
- `NEXT_PUBLIC_APP_URL` to the public web URL
- `WEB_PROXY_SECRET` / `INTERNAL_FETCH_TOKEN` / `REVALIDATE_SECRET` to the same
  values in both processes

## Scripts

From the repository root:

| Script | Purpose |
|---|---|
| `pnpm api:dev` | `tsx watch` dev server on `PORT` |
| `pnpm api:build` | Bundle to `apps/api/dist` with tsup |
| `pnpm api:start` | Run the production bundle |
| `pnpm api:test` | Vitest unit tests |
| `pnpm typecheck:all` | Typecheck every workspace package |
| `pnpm db:generate` | Regenerate Prisma Client |
| `pnpm db:migrate` | Create/apply a dev migration |
| `pnpm db:deploy` | Apply committed migrations (production) |
| `pnpm db:seed` | Seed the owner account |
| `pnpm job:analytics` | Run the nightly rollup/purge job once |

## Environment

Required in every environment:

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Pooled runtime connection string |
| `DIRECT_URL` | Direct connection used by migrations and the job |
| `SESSION_SECRET` | ≥32 chars; signs session and CSRF cookies |
| `ANALYTICS_HASH_SECRET` | ≥32 chars; keys the daily visitor hash |
| `REVALIDATE_SECRET` | Shared with the web app's revalidation route |
| `INTERNAL_FETCH_TOKEN` | Shared bearer token for internal fetches |
| `WEB_PROXY_SECRET` | Shared secret that makes `x-vercel-ip-country` trusted |
| `APP_URL` | Web origin used for Origin/CSRF checks |
| `PORT` | API port (default `4000`) |

Useful feature flags: `ALLOW_SIGNUP`, `ALLOW_DEMO_PREVIEW` (web),
`TRUST_PROXY` (verified hop count, never `true`), `DEBUG_IP_ENDPOINT`
(development only), `ACCOUNT_DELETION_GRACE_DAYS`,
`EMAIL_VERIFICATION_TTL_HOURS`, `PASSWORD_RESET_TTL_MINUTES`,
`CLICK_DEDUPE_SECONDS`.

Email uses `EMAIL_PROVIDER=console` locally. Messages are written to
`apps/api/.mail-outbox/` (gitignored) instead of being sent. For production,
set `EMAIL_PROVIDER=brevo` and `EMAIL_BREVO_API_KEY` (recommended), or
`EMAIL_PROVIDER=resend` and `EMAIL_RESEND_API_KEY`. `EMAIL_FROM` must use a
sender address on a domain authenticated in the provider, for example
`Link Hub <no-reply@nayankunwar.com>`.

In production the process refuses to start with development fallbacks for
`SESSION_SECRET`, `ANALYTICS_HASH_SECRET`, `REVALIDATE_SECRET`,
`INTERNAL_FETCH_TOKEN` or `WEB_PROXY_SECRET`.

## API shape

- Base path: `/api/v1`
- Success: `{ "success": true, "data": … }`
- Error: `{ "success": false, "error": { "code", "message", "details?" } }`
- Health: `GET /api/v1/health` (DB readiness) and `/api/v1/health/live`
- Every response carries `X-Request-Id`.

All non-GET requests require a matching `Origin` and an `X-CSRF-Token` header
that matches the readable `lh.csrf` cookie. The one exception is the anonymous
click beacon `POST /api/v1/analytics/clicks`, which checks Origin only, accepts
`text/plain`, deduplicates repeat taps, drops known bots, and always returns
`204`.

Sessions last 7 rolling days. Password changes and resets revoke every other
session. Account deletion schedules a 30-day grace period, unpublishes the
profile immediately and sends a single-use restore link; logging in during the
grace period also restores the account. Restoring never republishes.

## Testing

```bash
pnpm api:test          # Vitest, no database required
pnpm typecheck:all
pnpm build
```

For a manual smoke test, start PostgreSQL and the API, then exercise login,
links/categories, analytics, export and the account lifecycle. The local
`.mail-outbox` contains verification/reset/restore tokens when
`EMAIL_PROVIDER=console`.

## Deployment

See [`DEPLOYMENT.md`](../../DEPLOYMENT.md) for the full Neon + Render + Vercel
runbook. The repository's `render.yaml` defines `linkhub-api`: a Node web
service in Singapore on Render's free plan with health check
`/api/v1/health/live`.

The free plan does not support `preDeployCommand` or cron jobs:

- Run `pnpm db:deploy` manually before deploying schema-dependent changes.
- Nightly analytics runs from `.github/workflows/analytics-nightly.yml`,
  dispatched by cron-job.org every day at 03:17 UTC. It takes a PostgreSQL
  advisory lock, so overlapping runs are safe.

Set `DATABASE_URL` (pooled) and `DIRECT_URL` (direct) from Neon, keep the web
and API `APP_URL` values aligned, and set `TRUST_PROXY` to the real proxy hop
count. Put the API behind HTTPS; cookies are `Secure` when
`NODE_ENV=production`. Monitor `GET /api/v1/health`; it returns `503` when the
database is down. `/api/v1/health/live` stays `200` so the platform does not
restart-loop on a database outage.

Never store or log IP addresses. Country analytics only trust
`x-vercel-ip-country` when the request also presents the correct
`x-web-proxy-secret`; all other requests are recorded as `OTHER`. Visitor
dedupe hashes are keyed per UTC day and cleared by the nightly job.
