# Deploying LinkHub

Production topology:

| Piece | Platform | URL |
|---|---|---|
| Web (Next.js) | Vercel | `https://link.nayankunwar.com` |
| API (Express) | Render | `https://linkhub-api-yphe.onrender.com` (or a custom API domain) |
| Nightly analytics | GitHub Actions | 03:00 UTC |
| PostgreSQL | Neon | Singapore region |
| Email | Brevo | `no-reply@nayankunwar.com` |

Deploy in this order: Neon → Render API → seed → Vercel → DNS → smoke tests.

---

## 1. Generate shared secrets

Generate five **distinct** values. `REVALIDATE_SECRET`, `INTERNAL_FETCH_TOKEN`
and `WEB_PROXY_SECRET` must be identical on Render and Vercel.

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Run it five times and label the results:

- `SESSION_SECRET`
- `REVALIDATE_SECRET`
- `INTERNAL_FETCH_TOKEN`
- `WEB_PROXY_SECRET`
- `ANALYTICS_HASH_SECRET`

Do not reuse any value. Production startup rejects short, reused or
placeholder secrets.

---

## 2. Neon

1. Create a project in **Singapore** with PostgreSQL 16.
2. Copy both connection strings from **Connect**:
   - **Pooled** → `DATABASE_URL`
   - **Direct** → `DIRECT_URL`
3. Append the Prisma parameters:

```env
DATABASE_URL="postgresql://...-pooler.../neondb?sslmode=require&pgbouncer=true&connection_limit=5"
DIRECT_URL="postgresql://.../neondb?sslmode=require"
```

Keep the quotes: the URLs contain `&`, and the runbook sources this file from a
shell.

4. Apply migrations and seed the owner from your machine. Copy
   `.env.deploy.example` to `.env.deploy.local` (gitignored), fill in the Neon
   URLs and secrets, then run:

```bash
# Load the production values into the current shell.
set -a; source .env.deploy.local; set +a

pnpm db:deploy
pnpm db:seed
```

The seed creates the `nayankunwar` owner, marks the email verified, and publishes an
empty profile. It creates no demo links or categories. Store the owner password
in your password manager. Rerunning the seed against an existing owner **resets
that account's password** and republishes the profile; do not rerun it after
changing the production password unless you intend to reset it.

Verify:

```bash
psql "$DIRECT_URL" -c "select email, role, status from users;"
psql "$DIRECT_URL" -c "select username, is_published from profiles;"
```

---

## 3. Render API (free plan)

The repository contains `render.yaml` for the API web service. The free plan
does not support `preDeployCommand` or cron jobs, so migrations are run manually
and the nightly analytics job runs from GitHub Actions.

1. In Render: **New → Blueprint**, connect the GitHub repository, and apply
   `render.yaml`.
2. Fill the `sync: false` values:
   - `DATABASE_URL` and `DIRECT_URL` from Neon
   - the five secrets from step 1
   - `EMAIL_BREVO_API_KEY` from Brevo
3. Confirm the service settings:
   - Region: Singapore
   - Plan: Free
   - Health check: `/api/v1/health/live`
   - `TRUST_PROXY=3` (verified Render/Cloudflare hop count; do not change
     without repeating the probe procedure in `link-hub-architecture.md` §17)
4. Keep `EMAIL_PROVIDER=brevo` for production. The API refuses to start with
   the console mailer unless `ALLOW_CONSOLE_MAIL_IN_PRODUCTION=true` is set
   deliberately; do not enable that override on the public site. If Brevo is
   not ready, finish the Brevo setup before the first public deploy.
5. Deploy. The build runs `pnpm install`, `pnpm db:generate` and
   `pnpm api:build`.
6. Copy the service URL, for example
   `https://linkhub-api-yphe.onrender.com`.

Check:

```bash
curl -fsS https://linkhub-api-yphe.onrender.com/api/v1/health
curl -fsS https://linkhub-api-yphe.onrender.com/api/v1/health/live
```

`/health` returns `503` if the database is unreachable. `/health/live` stays
`200` so Render does not restart-loop during a database outage.

### Free-plan cold starts

Free instances sleep after 15 minutes of inactivity and take roughly 30–60
seconds to wake. Measured 2026-10-27: with both uptime monitors paused for about
20 minutes, the first `GET /api/v1/health` through the Vercel rewrite took
**57.1 s** and returned `200`; the next requests took 0.72 s (readiness) and
0.37 s (liveness). A cold first login or dashboard request can therefore still
exceed the Vercel proxy timeout.

Keep-warm verified 2026-10-27: after the cold-start test, the API was left
alone from 02:27 UTC. At 02:46 UTC `uptime` was **1,356 s** and the response
took 1.60 s, so the instance never slept — the 5-minute liveness monitor is
active. Options:

- Add a free UptimeRobot monitor (or similar) pinging
  `https://linkhub-api-yphe.onrender.com/api/v1/health/live` every 5 minutes.
  Use `/health/live`, not `/health`: the live check does not query Postgres, so
  the pings do not keep Neon awake and consume its free compute hours.
- Upgrade the Render service to an always-on paid instance later.

Profile **data** is cached in Next's Data Cache for 300 seconds and is
invalidated by the `profile:<username>` tag. Profile **HTML** is rendered per
request (`Cache-Control: no-store`) and is not served from Vercel's HTML cache.
Because the data fetch is cached, a profile request does not normally hit the
API.

### Migrations

The schema is already applied. For future schema changes, run migrations from
your machine before deploying the code that depends on them:

```bash
set -a; source .env.deploy.local; set +a
pnpm db:deploy
```

The free plan has no pre-deploy command, so this is a manual step.

### Nightly analytics

The workflow is `.github/workflows/analytics-nightly.yml`. It runs at **03:00
UTC** daily and can be started manually from **Actions → Nightly analytics →
Run workflow**.

Add only these two repository secrets under **Settings → Secrets and variables
→ Actions**:

- `DATABASE_URL`
- `DIRECT_URL`

The workflow deliberately receives no signing, proxy, or analytics secrets.
The job takes a PostgreSQL advisory lock, so overlapping runs are safe.
Scheduled runs can be delayed during high load. GitHub only disables schedules
after 60 days without repository activity in public repositories; this one is
private, but re-enable the workflow if GitHub ever warns you.

If a run fails, the workflow opens or comments on a GitHub issue labeled
`nightly-failure` with the run URL and commit SHA. Check the job log first, then
the Render service log; rerunning is safe.

### Monitoring and alerts

- **Uptime:** UptimeRobot Free runs two monitors.
  `https://linkhub-api-yphe.onrender.com/api/v1/health/live` is checked every
  5 minutes to keep the free instance warm; it does not query Postgres.
  `https://linkhub-api-yphe.onrender.com/api/v1/health` (readiness; checks
  Postgres) is checked every 30 minutes so a database outage alerts you. Do not
  check readiness every 5 minutes: each check wakes Neon, and a 5-minute
  interval would use roughly 182 CU-hours/month at 0.25 CU, exceeding the
  100 CU-hour Free allowance. The free plan allows 50 monitors.
- **API errors:** any 5xx sends a throttled email to active owner accounts (at
  most one per 15 minutes per API instance). The email contains the request ID,
  method, path, status, code, error name and user ID. It never contains request
  bodies, IP addresses, stack traces, tokens or email addresses. Look up the
  request ID in Render logs for the redacted stack.
- **Nightly job:** a failed run opens or updates a `nightly-failure` GitHub
  issue.
- **Audit log:** security-relevant actions emit Pino lines with `"audit": true`
  (registration, login/logout, email verification/change, password change/reset,
  session revocation, deletion scheduled/cancelled/restored/purged, profile
  publish/unpublish, username change). Render Hobby retains logs for 7 days;
  forward the log stream if you need a longer trail.
- **Log review:** keep `LOG_LEVEL=info`; do not enable `debug` or `trace` in
  production. Check Render logs for 5xx responses, `express-rate-limit`
  warnings, failed email delivery, and unexpected audit events.

### Free-tier quota watch (reviewed 2026-10-27)

| Vendor | Free limit | Watch |
|---|---|---|
| Render | 750 instance hours/month; 5 GB outbound bandwidth; 512 MB RAM | One API service running 24/7 uses about 730 hours, leaving ~20. A second free Render service would exceed the hours. Render's free docs say free instances are not for production. |
| Vercel Hobby | 100 GB fast data transfer; 1M function invocations; 4 CPU-hours; 360 GB-hours | Public profile HTML is rendered per request; profile data is cached for 300 seconds. Hobby is non-commercial only; a public multi-tenant launch may require Pro or another host. |
| Neon Free | 100 CU-hours/project/month; 1 GB storage; 6-hour history; one manual snapshot; no full PITR | Database is 8.7 MB. If revalidation or API traffic keeps compute awake, 100 CU-hours can run out before month-end. Monitor **Usage** in the Neon console. |
| Brevo Free | 300 emails/day | Signup, verification, reset, email-change, restore, contact and 5xx alerts share the quota. Watch **Statistics** after a signup spike. |
| UptimeRobot Free | 50 monitors; 5-minute interval | Liveness `/health/live` every 5 minutes and readiness `/health` every 30 minutes are active. |
| GitHub Actions | 2,000 minutes/month for private repos | Nightly job uses about 30 minutes/month. |

The measured database on 2026-10-27 was `8,672 kB` with 2 users, 2 profiles,
8 links, 5 categories, 5 click events, 1 session and 5 verification tokens.
Render, Vercel and Brevo dashboard usage still needs an owner review because
those accounts have no API token configured here.

A fresh logical dump was taken 2026-10-27 (`36,396` bytes, all 12 tables,
verified with `pg_restore --list`) and stored off-machine with a metadata
sidecar. See **Logical backups** below.

> **Decision 2026-10-27:** stay private on the free tiers and keep
> `ALLOW_SIGNUP=false` while the cold-start, recovery and vendor-policy items
> are resolved. Before any public signup, record whether you accept the
> free-tier availability, quota and vendor-policy risk, or move the affected
> piece to a paid or commercial-friendly tier. Render free is documented as not
> for production, Vercel Hobby is non-commercial only, and Neon Free has no full
> PITR.

### Logical backups (Neon Free has no full PITR)

Neon Free provides only a 6-hour history window and one manual snapshot. Keep a
current `pg_dump --format=custom` copy outside this repository and off the
machine (for example the owner's cloud drive):

```bash
set -a; source .env.deploy.local; set +a
mkdir -p "$HOME/LinkHub Backups"
docker run --rm -e PGURL="$DIRECT_URL" postgres:18-alpine \
  sh -c 'pg_dump --format=custom --no-owner --no-privileges --dbname="$PGURL"' \
  > "$HOME/LinkHub Backups/linkhub-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

Verify each dump before relying on it:

```bash
docker run --rm -i postgres:18-alpine pg_restore --list < path/to/linkhub-*.dump | head
```

Record the date, byte size and SHA-256 in the owner's local backup log; never
commit the dump. Take a fresh dump before migrations and before the public flip,
and test a restore into a throwaway database periodically.

### Optional: API custom domain

If you prefer `api.nayankunwar.com`, add it in Render → Settings → Custom
Domains, create the shown CNAME at Hostinger, and use that URL for
`API_BASE_URL` on Vercel. Otherwise use the `onrender.com` URL.

---

## 4. Brevo

1. Create a Brevo account.
2. **Settings → Senders, Domains & Dedicated IPs → Domains → Add domain**:
   `nayankunwar.com`.
3. Choose **Authenticate the domain yourself** and add the Brevo code, DKIM and
   DMARC records at **Hostinger → Domains → nayankunwar.com → DNS / DNS Zone**.
   - DKIM is the critical record; use exactly what Brevo shows.
   - DMARC can start at `p=none`. Point `rua` at a mailbox that exists outside
     this domain; `nayankunwar.com` has no MX records.
   - If Brevo shows an SPF value, use that exact value. Do not create a second
     SPF record.
4. Add the sender `no-reply@nayankunwar.com`. Once the domain is authenticated,
   Brevo auto-verifies senders on that domain, so no inbox is needed. Confirm
   the sender is listed under **Senders**.
5. **SMTP & API → API Keys → Generate a new API key (v3)**. Copy it once.
6. Set on Render: `EMAIL_PROVIDER=brevo`, `EMAIL_BREVO_API_KEY=...`, and
   `EMAIL_FROM="Link Hub <no-reply@nayankunwar.com>"` (already in
   `render.yaml` except the key).
7. Disable **Settings → Security → Authorized IPs → Blocking unauthorized IP
   addresses → API keys**. Render's free-plan egress IPs are dynamic, so an
   allowlist cannot cover them. If Brevo ever reactivates this automatically,
   outbound email will fail until it is deactivated again.

Test delivery:

```bash
curl -X POST https://api.brevo.com/v3/smtp/email \
  -H "api-key: $EMAIL_BREVO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "sender": { "name": "Link Hub", "email": "no-reply@nayankunwar.com" },
    "to": [{ "email": "you@example.com" }],
    "subject": "LinkHub Brevo test",
    "textContent": "Brevo is working."
  }'
```

Check the received message's original headers for `DKIM: PASS`
(`d=nayankunwar.com`) and `DMARC: PASS`. A `via brevosend.com` label means
domain authentication is incomplete. SPF may show `none` because Brevo's
domain authentication uses DKIM + DMARC and does not require an SPF record.
To add SPF alignment too, create one TXT record:
`v=spf1 include:spf.brevo.com ~all` (only if nothing else sends from the
domain).

---

## 5. Vercel web

1. **Add New → Project**, import the repository.
2. Set:
   - **Root Directory:** `apps/web`
   - **Framework Preset:** Next.js
   - **Include files outside the root directory in the Build Step:** enabled
   - **Node.js Version:** 22.x (also pinned in `apps/web/package.json`)
3. Add environment variables for **Production** (and Preview if desired):

| Variable | Value |
|---|---|
| `API_BASE_URL` | Render service URL, no trailing slash |
| `NEXT_PUBLIC_APP_URL` | `https://link.nayankunwar.com` |
| `NEXT_PUBLIC_ALLOW_SIGNUP` | `false` |
| `ALLOW_DEMO_PREVIEW` | `false` |
| `ROOT_MODE` | `landing` (marketing page at `/`; owner profile stays at `/nayankunwar`). Use `profile` only if `/` should serve the owner profile. |
| `DEFAULT_USERNAME` | `nayankunwar` |
| `REVALIDATE_SECRET` | same value as Render |
| `INTERNAL_FETCH_TOKEN` | same value as Render |
| `WEB_PROXY_SECRET` | same value as Render |

`API_BASE_URL`, `ROOT_MODE` and `DEFAULT_USERNAME` are read at build time. If
the Render URL or root mode changes, update it and redeploy.

4. Deploy. The web app serves same-origin `/api/*` and rewrites it to Render.
5. **Settings → Domains → Add** `link.nayankunwar.com`. Create the CNAME Vercel
   shows at Hostinger:

| Type | Name | Value |
|---|---|---|
| CNAME | `link` | `cname.vercel-dns.com` |

Wait for Vercel to show the domain as valid; HTTPS is issued automatically.

> Vercel Hobby is for non-commercial use. A public, multi-tenant LinkHub needs
> Vercel Pro.

---

## 6. Production smoke test

1. `https://link.nayankunwar.com` loads the marketing page; the owner profile
   is at `/nayankunwar`. The first API-backed request after Render has been
   idle may take 30–60 seconds while the free instance wakes.
2. `/login` signs in as the seeded owner; the session cookie is
   `__Host-lh.sid` and the readable CSRF cookie is `__Host-lh.csrf`. Both are
   `Secure`, `Path=/` and host-only; logout clears both.
3. Create a link, toggle it inactive, delete it.
4. Rename the profile and confirm the public page updates immediately (the
   `profile:<username>` tag is revalidated and the route re-renders with fresh
   data).
5. Trigger **Forgot password** and confirm the Brevo email arrives; complete the
   reset.
6. Open a public link and check `/dashboard/analytics` for the click.
7. Confirm `https://link.nayankunwar.com/api/v1/health` returns `200`.
8. Check Render logs for errors and confirm no IP addresses or tokens appear.
   Confirm the expected `audit` events (`auth.login`, etc.) are present.
9. If a password was shared in chat or a support ticket, rotate it immediately
   from **Settings → Account** and store the new value only in your password
   manager. A password change revokes every other session.

Run the nightly job once from **GitHub → Actions → Nightly analytics → Run
workflow** and confirm it exits successfully. A failed run should create or
update a `nightly-failure` issue.

---

## Rollback

- **Vercel:** promote a previous deployment from the Deployments tab.
- **Render:** redeploy a previous commit; Prisma migrations are forward-only,
  so write a compensating migration before rolling back schema changes.
- **Neon:** Free has no full point-in-time restore. Use the 6-hour history
  window or the one manual snapshot if available, otherwise restore the latest
  `pg_dump --format=custom` backup into a new branch/database and repoint
  `DATABASE_URL` and `DIRECT_URL`. Keep an off-machine backup current before
  schema changes.
- **Free-tier suspension:** if Render's 750 instance hours or Neon's 100
  CU-hours are exhausted, the service or compute suspends until the next
  billing period. Data is not deleted; wait for the reset or upgrade.

Never commit `.env`, `.env.deploy.local`, API keys, or the owner password.
