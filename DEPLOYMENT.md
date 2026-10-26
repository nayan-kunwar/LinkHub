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
in your password manager.

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
   - `TRUST_PROXY=1`
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
seconds to wake. The first login or dashboard request after idle can exceed the
Vercel proxy timeout. Options:

- Add a free UptimeRobot monitor (or similar) pinging
  `https://linkhub-api-yphe.onrender.com/api/v1/health/live` every 5 minutes.
  Use `/health/live`, not `/health`: the live check does not query Postgres, so
  the pings do not keep Neon awake and consume its free compute hours.
- Upgrade the Render service to an always-on paid instance later.

Public profile pages are cached, but a cache miss still waits for the API.

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
| `ROOT_MODE` | `profile` (use `landing` for the marketing page at `/`) |
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

1. `https://link.nayankunwar.com` loads the owner profile. The first request
   after Render has been idle may take 30–60 seconds while the free instance
   wakes.
2. `/login` signs in as the seeded owner; the session cookie is
   `__Host-lh.sid` and `Secure`.
3. Create a link, toggle it inactive, delete it.
4. Rename the profile and confirm the public page updates immediately (ISR
   revalidation).
5. Trigger **Forgot password** and confirm the Brevo email arrives; complete the
   reset.
6. Open a public link and check `/dashboard/analytics` for the click.
7. Confirm `https://link.nayankunwar.com/api/v1/health` returns `200`.
8. Check Render logs for errors and confirm no IP addresses or tokens appear.

Run the nightly job once from **GitHub → Actions → Nightly analytics → Run
workflow** and confirm it exits successfully.

---

## Rollback

- **Vercel:** promote a previous deployment from the Deployments tab.
- **Render:** redeploy a previous commit; Prisma migrations are forward-only,
  so write a compensating migration before rolling back schema changes.
- **Neon:** use point-in-time restore if data is damaged.

Never commit `.env`, `.env.deploy.local`, API keys, or the owner password.
