# Deploying LinkHub

Production topology:

| Piece | Platform | URL |
|---|---|---|
| Web (Next.js) | Vercel | `https://link.nayankunwar.com` |
| API (Express) | Render | `https://linkhub-api-yphe.onrender.com` (or a custom API domain) |
| Nightly analytics | cron-job.org → GitHub Actions | 03:17 UTC |
| PostgreSQL | Neon | Singapore region |
| Email | Brevo | `no-reply@nayankunwar.com` |

Deploy in this order: Neon → migrations → Render API → seed → Vercel → DNS → smoke tests.

See [`docs/external-services.md`](docs/external-services.md) for the full
inventory of external services, free-tier limits, failure impact and the secrets
register.

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

1. Create a project in **Singapore** with PostgreSQL 18 (Neon's current default; the production project reports version 18).
2. Copy both connection strings from **Connect**:
   - **Pooled** → `DATABASE_URL`
   - **Direct** → `DIRECT_URL`
3. Append the Prisma parameters:

```env
DATABASE_URL="postgresql://...-pooler.../neondb?sslmode=require&pgbouncer=true&connection_limit=5&connect_timeout=120"
DIRECT_URL="postgresql://.../neondb?sslmode=require&connect_timeout=120"
```

Keep the quotes: the URLs contain `&`, and the runbook sources this file from a
shell. `connect_timeout=120` is required on networks that resolve Neon's IPv6
addresses but cannot route them; see **Prisma P1001** below. It makes a cold
migration take roughly two minutes while Prisma falls through to IPv4.

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

### Prisma P1001 from a local machine (IPv6 fallback)

Symptom: `pnpm db:deploy` or `prisma migrate status` fails with

```text
P1001: Can't reach database server at `ep-....aws.neon.tech:5432`
```

even though `Test-NetConnection -ComputerName <host> -Port 5432` returns
`True`. Neon publishes multiple IPv6 (`AAAA`) and IPv4 (`A`) records for each
endpoint. On a network that advertises IPv6 but cannot route it, Prisma tries
the IPv6 addresses first; each attempt hangs until the connect timeout, so the
IPv4 addresses are never reached. `NODE_OPTIONS=--dns-result-order=ipv4first`
does not help — the Prisma engine resolves names in Rust, not through Node.

Fix: keep `connect_timeout=120` on **both** URLs (the example above already
does). The timeout gives Prisma time to fall through the dead IPv6 addresses to
IPv4. A cold migration then takes roughly **2 minutes** instead of a few
seconds. Verify:

```bash
set -a; source .env.deploy.local; set +a
pnpm prisma migrate status
# Database schema is up to date!
```

If it still fails, confirm the Neon project is active, the host matches
**Connect → Direct connection** in the Neon console, and the machine can reach
port 5432 over IPv4. Do not disable TLS: Neon requires `sslmode=require`.
Pinning the hostname to an IPv4 address in the OS `hosts` file skips the IPv6
wait, but Neon's IPs can change; remove the entry after the migration.

---

## 3. Render API (free plan)

The repository contains `render.yaml` for the API web service. The free plan
does not support `preDeployCommand` or cron jobs, so migrations are run manually
and the nightly analytics job runs in GitHub Actions, dispatched by cron-job.org.
`render.yaml` also sets a build filter that ignores Markdown, `docs/`,
`apps/web/` and `.github/`, so documentation and web-only commits do not restart
the API. API, `packages/shared`, `prisma` and lockfile changes still deploy.

1. In Render: **New → Blueprint**, connect the GitHub repository, and apply
   `render.yaml`.
2. Fill the `sync: false` values:
   - `DATABASE_URL` and `DIRECT_URL` from Neon
   - the five secrets from step 1
   - `EMAIL_BREVO_API_KEY` from Brevo
   - optional: `GOOGLE_CLIENT_ID` for Google sign-in and sign-up. Leave it empty
     to keep the feature disabled; see **5.1 Google sign-in and sign-up
     (optional)**.
   `METADATA_FETCH_ENABLED=true` and the default `METADATA_SKIP_HOSTS` are set
   in `render.yaml`; no action is needed unless you want to change preview
   behaviour.
3. Confirm the service settings:
   - Region: Singapore
   - Plan: Free
   - Health check: `/api/v1/health/live`
   - `TRUST_PROXY=3` (verified client → Cloudflare edge → Render proxy hop
     count; Cloudflare is Render's edge, not a separate zone; do not change
     without repeating the probe procedure in `link-hub-architecture.md` §17)
4. Keep `EMAIL_PROVIDER=brevo` for production. The API refuses to start with
   the console mailer unless `ALLOW_CONSOLE_MAIL_IN_PRODUCTION=true` is set
   deliberately; do not enable that override on the public site. If Brevo is
   not ready, finish the Brevo setup before the first public deploy.
5. Deploy. The build runs `pnpm install`, `pnpm db:generate`,
   `pnpm db:deploy` and `pnpm api:build`. The migration step uses `DIRECT_URL`;
   keep `connect_timeout=120` on it if the build network has the IPv6 fallback
   described in §2.
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

The schema is already applied. `render.yaml` sets `autoDeployTrigger: commit`,
so merging to `main` deploys the API immediately. The free plan has no
`preDeployCommand`, so the build command runs `pnpm db:deploy` before
`pnpm api:build`: every deploy applies pending migrations before the new API
starts. This is why a Release 1 merge without the migration produced 500s.

To apply or check migrations locally without deploying:

```bash
set -a; source .env.deploy.local; set +a
pnpm db:deploy
```

Keep migrations backward-compatible (expand/contract), because the old API may
still serve traffic while the build runs. If you ever remove the build-command
step, the fallback is to disable Render auto-deploy, run the migration, then
trigger the deploy (or merge only after `db:deploy` succeeds).

Never run `prisma migrate dev` or `prisma db push` against production.

### Link previews (Release 2.1)

Rich/featured link cards use the destination page's Open Graph/Twitter image
and text. Metadata is fetched and stored by the API only; the web app never
sends it. The migration `20261101000000_link_metadata` adds the
`links.metadata` JSONB column with a `{}` default and is applied by the normal
`pnpm db:deploy` build step.

Operational controls:

- `METADATA_FETCH_ENABLED=true` is the normal setting. Set it to `false` and
  redeploy the API to stop all outbound preview fetches during an incident;
  saved links and public rendering keep working.
- `METADATA_SKIP_HOSTS` defaults to Instagram and Amazon hosts. Those links
  skip the network fetch and show the icon fallback.
- The API allows 20 preview fetches per user per minute (shared across editor
  preview, manual refresh and save-time fetches) with at most 4 concurrent
  outbound requests. The in-memory cache is 10 minutes per user + URL.
- Outbound requests are SSRF-guarded: only public addresses, ports 80/443,
  no credentials, a pinned DNS lookup, per-redirect validation, 512 KiB body
  limit and a 5-second deadline. Only HTTPS preview images are accepted.

If a preview fetch fails during save, the link is still saved and the old
metadata (if any) is kept. Manual refresh likewise leaves the previous metadata
intact on failure.

### Nightly analytics

The workflow is `.github/workflows/analytics-nightly.yml`. A free
**cron-job.org** job dispatches it every day at **03:17 UTC**; it can also be
started manually from **Actions → Nightly analytics → Run workflow**. See
[`docs/nightly-analytics-trigger.md`](docs/nightly-analytics-trigger.md) for the
2026-10-27 trigger migration, verification evidence and PAT rotation.

cron-job.org request:

- URL:
  `https://api.github.com/repos/nayan-kunwar/LinkHub/actions/workflows/396782571/dispatches`
- Method: `POST`
- Headers: `Accept: application/vnd.github+json`,
  `Authorization: Bearer <fine-grained PAT>`,
  `X-GitHub-Api-Version: 2026-03-10`,
  `Content-Type: application/json`
- Body: `{"ref":"main"}`

A successful dispatch returns **204 No Content** or **200 OK** (GitHub has
returned both). The PAT is fine-grained, scoped to this repository only,
granted **Actions: Read and write**, and set to expire; store it only in
cron-job.org and rotate it before expiry. Never commit it or paste it into an
issue.

GitHub's own `schedule` trigger is deliberately not used. On 2026-10-27 the
03:00 UTC run never appeared (zero `schedule`-triggered runs through 04:20 UTC)
while GitHub reported Actions operational; GitHub schedules are best-effort and
can be delayed or dropped. The job is idempotent and takes an advisory lock, so
a manual rerun is always safe.

Add only these repository secrets under **Settings → Secrets and variables →
Actions**:

- `DATABASE_URL`
- `DIRECT_URL`
- `HEARTBEAT_URL` — Healthchecks.io ping URL for the dead-man's switch

The workflow deliberately receives no signing, proxy, or analytics secrets.

On success the workflow pings Healthchecks.io (`LinkHub nightly analytics`,
daily at 03:17 UTC, 2-hour grace). If no ping arrives by about **05:17 UTC**,
Healthchecks emails the owner. This catches the failure mode a GitHub issue
cannot: the job never started. If a run fails, the workflow opens or comments
on a GitHub issue labeled `nightly-failure` with the run URL and commit SHA;
cron-job.org also emails when the dispatch itself returns non-2xx.

Verified 2026-10-27 with manual run `40463090302` and cron-job.org test run
`40467931426`: the job and `Ping heartbeat` steps succeeded and the failure
step was skipped. The first automatic run started on schedule on 2026-10-28 at
03:17:05 UTC (run `40625796861`) and succeeded, including the heartbeat ping.

Recovery:

```bash
gh workflow run analytics-nightly.yml -R nayan-kunwar/LinkHub
```

Check the job log first, then the Render service log; rerunning is safe. If
cron-job.org reports a failure, check the PAT expiry and GitHub status, then
dispatch manually.

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
  issue. A success-only ping to Healthchecks.io is the dead-man's switch: the
  check alerts if no successful run is recorded by about 05:17 UTC, which also
  catches a dropped trigger. cron-job.org emails on dispatch failures (non-2xx).
- **Audit log:** security-relevant actions emit Pino lines with `"audit": true`
  (registration, login/logout, email verification/change, password change/reset,
  session revocation, deletion scheduled/cancelled/restored/purged, profile
  publish/unpublish, username change). Render Hobby retains logs for 7 days;
  forward the log stream if you need a longer trail.
- **Log review:** keep `LOG_LEVEL=info`; do not enable `debug` or `trace` in
  production. Check Render logs for 5xx responses, `express-rate-limit`
  warnings, failed email delivery, and unexpected audit events.

### Free-tier quota watch (reviewed 2026-10-28)

| Vendor | Free limit | Watch |
|---|---|---|
| Render | 750 instance hours/month (workspace-wide); 5 GB outbound bandwidth; 512 MB RAM; 25 services; 2 custom domains; 500 pipeline minutes | One API service running 24/7 uses about 730 hours. The 2026-10-28 audit reduced the workspace from 12 to 8 services: 4 deleted, 2 suspended, 6 active — **all six active are Free**. LinkHub still shares the 750-hour pool with five other free web services; 24/7 leaves only 6-30 hours. Suspend the other five or isolate LinkHub. Observed 2026-10-28: 231.83 hours, 334 MB, 2/2 domains. Render's free docs say free instances are not for production. |
| Vercel Hobby | 100 GB fast data transfer; 10 GB fast origin transfer; 1M CDN requests; 1 h CDN CPU; 1M ISR reads; 200k ISR writes; 1M function invocations; 4 CPU-hours; 360 GB-hours | Public profile HTML is rendered per request; profile data is cached for 300 seconds. Observed 2026-10-28: 49.24 MB fast data transfer, 6,034 CDN requests. Hobby is non-commercial only; a public multi-tenant launch may require Pro or another host. |
| Neon Free | 100 CU-hours/project/month; 1 GB storage; 6-hour history; one manual snapshot; no full PITR; PostgreSQL 18 | Observed 2026-10-28: 5.46 CU-hrs, 32.97 MB storage, 4.25 MB history. Recheck after a week of normal traffic; 5-minute readiness checks would use ~182 CU-hours/month. |
| Brevo Free | 300 emails/day | Observed 2026-10-28: 300 available. Signup, verification, reset, email-change, restore, contact and 5xx alerts share the quota. Watch **Statistics** after a signup spike. |
| UptimeRobot Free | 50 monitors; 5-minute interval | Liveness `/health/live` every 5 minutes and readiness `/health` every 30 minutes are active. |
| GitHub Actions | 2,000 minutes/month for private repos | Nightly job uses about 30 minutes/month. |
| cron-job.org | Free; up to 60 executions/hour; 30 s request timeout | One dispatch per day at 03:17 UTC. The dispatch returns 200 or 204 immediately, so the timeout is not on the job's runtime. |
| Healthchecks.io | Hobbyist: 20 checks; 100 log entries per check | One check for the nightly job. A daily ping keeps roughly three months of history. |

The measured database on 2026-10-27 was `8,672 kB` with 2 users, 2 profiles,
8 links, 5 categories, 5 click events, 1 session and 5 verification tokens.
Vendor usage was reviewed on 2026-10-28: Vercel, Render, Neon and Brevo are
within their free limits. The remaining Render risk is workspace-wide instance
hours: after the 2026-10-28 cleanup, 8 services exist — 6 active (all Free),
2 suspended and 4 deleted. LinkHub shares the 750-hour pool with five other
free web services, so suspend them or isolate LinkHub before public launch.

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
| `NEXT_PUBLIC_ALLOW_SIGNUP` | `true` only when the API also has `ALLOW_SIGNUP=true`; this build-time flag opens `/signup` and the Google entry screen. |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Optional. Same Web OAuth client ID as Render's `GOOGLE_CLIENT_ID`; leave unset to hide the Google button. |
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

### 5.1 Google sign-in and sign-up (optional)

Google sign-in and Google-first sign-up have been live in production since
2026-10-30. Existing accounts sign in only when their Google subject is already
linked. New accounts are created only when `ALLOW_SIGNUP=true`; the user
confirms one editable **Choose your LinkHub URL** screen and lands on the
dashboard. Google email is never auto-linked to an existing account. The full
design, error codes and security notes are in
[`docs/google-sign-in.md`](docs/google-sign-in.md).

1. Create a **Web application** OAuth client in **Google Cloud Console → APIs &
   Services → Google Auth Platform → Clients**:
   - Authorized JavaScript origins: `https://link.nayankunwar.com` and
     `http://localhost:3000`
   - No client secret and no redirect URI are needed.
2. Add the scopes under **Google Auth Platform → Data Access**:
   - `openid`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
   GIS requests these as `openid email profile`; `profile` supplies the name
   used for the new-profile prefill. All three are non-sensitive, so no Google
   verification is required. See
   [`docs/google-sign-in.md`](docs/google-sign-in.md#scopes-data-access).
3. Set the same client ID in both places:
   - Render: `GOOGLE_CLIENT_ID`
   - Vercel: `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
4. Set the signup flags together:
   - Render: `ALLOW_SIGNUP=true`
   - Vercel: `NEXT_PUBLIC_ALLOW_SIGNUP=true`
   The web flag only controls whether `/signup` renders; the API flag is the
   security boundary. Keep them in sync.
5. Apply the new migration before or with the API deploy:

   ```bash
   set -a; source .env.deploy.local; set +a
   pnpm db:deploy
   ```

6. Redeploy the API (env change) and the web app (the `NEXT_PUBLIC_*` values
   are inlined at build time). Changing a Vercel environment variable does not
   rebuild an existing deployment.
7. Smoke-test both paths:
   - Sign in with a password, open **Settings → Connected accounts**, connect
     Google, sign out, then use **Sign in with Google**.
   - In a private window, open `/signup`, choose **Continue with Google**,
     confirm or edit the suggested URL, and land on the dashboard.
   - Open **Settings**, set a first password for the Google-created account,
     sign out, and sign in with that password.
   - Try a Google email that already has a password account; confirm the
     explicit **account exists** message and that no account is linked.
8. To disable the feature without a code change, remove the Vercel variable and
   redeploy the web app; remove the Render variable to make the API return
   `503 GOOGLE_SIGN_IN_DISABLED`. Existing links remain in `accounts` and can
   be removed from Settings. Setting `ALLOW_SIGNUP=false` stops new Google
   account creation but leaves sign-in for linked accounts working.

> **Before public Google sign-up:** as of 2026-10-30 the consent screen is still
> in **Testing**, with the scopes configured but the app unpublished. While in
> Testing, only accounts listed under **Audience → Test users** can complete
> Google sign-in or sign-up. To open it to the public:
>
> 1. Confirm **Google Auth Platform → Data Access** lists `openid`,
>    `userinfo.email` and `userinfo.profile`.
> 2. Open **Audience → Publish app**. Non-sensitive scopes need no verification.
> 3. Re-test with a Google account that is **not** a test user and confirm the
>    consent screen shows the account name and email with no unconfigured-scope
>    warning.

### 5.2 CI and Playwright E2E

`.github/workflows/ci.yml` runs on every push to `main` and every pull request:

- PostgreSQL 18 service, `prisma migrate deploy`, `prisma migrate status`, and
  `prisma db seed` on a throwaway database.
- `pnpm lint`, `pnpm typecheck:all`, `pnpm api:test`, `pnpm api:build`, and
  `pnpm build`.
- `playwright install --with-deps chromium`, then `pnpm e2e` against the built
  API and web servers.

The E2E suite is deterministic and offline. It seeds its own public cards
directly with Prisma, purges the seeded profile's cache tag, runs the API with
`METADATA_FETCH_ENABLED=false`, mocks the editor metadata endpoint in the
browser, and fulfils external images and the YouTube iframe locally. Run it
locally with:

```bash
docker start linkhub-postgres
pnpm db:deploy
pnpm db:seed
PLAYWRIGHT_CHANNEL=msedge pnpm e2e
```

`PLAYWRIGHT_CHANNEL=msedge` uses the installed Edge browser. Omit it in CI, or
run `pnpm e2e:install` once to download Playwright's bundled Chromium.

CI exercises the production builds. Reproduce that locally with:

```bash
pnpm api:build
ALLOW_DEMO_PREVIEW=false pnpm build
E2E_USE_BUILT_SERVERS=true PLAYWRIGHT_CHANNEL=msedge pnpm e2e
```

The built web server runs in production mode while the API runs in test mode, so
both servers set `SESSION_COOKIE_NAME=lh.sid` for the suite. Leave that variable
unset in production; the API keeps using the `__Host-lh.sid` cookie.

---

## 6. Production smoke test

1. `https://link.nayankunwar.com` loads the marketing page; the owner profile
   is at `/nayankunwar`. The first API-backed request after Render has been
   idle may take 30–60 seconds while the free instance wakes.
2. `/login` signs in as the seeded owner; the session cookie is
   `__Host-lh.sid` and the readable CSRF cookie is `__Host-lh.csrf`. Both are
   `Secure`, `Path=/` and host-only; logout clears both.
3. Create a link, toggle it inactive, delete it.
4. Open **Links → Add link** and create one **Header**, one **YouTube** (paste a
   video URL) and one **Contact** block. Set one link to the **Rich** card style
   with a manual image URL and another to **Featured**. In **Appearance**, switch
   between flat/grouped, a non-default theme, font and card/button shape; save.
   In a private window, confirm the public page renders every block, the
   **Share** button works (native share or clipboard fallback), and the layout
   matches.
5. **Release 2.1 previews:** create a Featured link to a public page with Open
   Graph tags (for example `https://github.com`), leave the image field empty,
   paste/blur the URL and confirm the editor shows the fetched title/image.
   Save, then open the public profile in a private window and confirm the card
   uses the preview image. Set a manual image and confirm it wins; toggle
   **Use page preview image** off and confirm the card falls back to the icon.
   Click **Refresh** on a saved link and confirm the image updates. Change the
   URL and confirm the old preview is not reused. Try an Instagram or Amazon
   link and confirm the hint and icon fallback. Confirm a YouTube block still
   shows its video thumbnail and loads the iframe only after clicking play.
   Finally set `METADATA_FETCH_ENABLED=false` on Render, redeploy, and confirm
   new preview requests return `503 METADATA_DISABLED` while saved cards still
   render; restore `true` afterwards.
6. Click the YouTube play button and a contact row, then confirm both appear in
   `/dashboard/analytics` after the 30-second dedupe window.
7. Rename the profile and confirm the public page updates immediately (the
   `profile:<username>` tag is revalidated and the route re-renders with fresh
   data).
8. Trigger **Forgot password** and confirm the Brevo email arrives; complete the
   reset.
9. Open a classic link and check `/dashboard/analytics` for the click.
10. Confirm `https://link.nayankunwar.com/api/v1/health` returns `200`.
11. Check Render logs for errors and confirm no IP addresses or tokens appear.
    Confirm the expected `audit` events (`auth.login`, etc.) are present.
12. If a password was shared in chat or a support ticket, rotate it immediately
    from **Settings → Account** and store the new value only in your password
    manager. A password change revokes every other session.

Run the nightly job once from **GitHub → Actions → Nightly analytics → Run
workflow** and confirm it exits successfully, the `Ping heartbeat` step passes,
and Healthchecks.io records the ping. A failed run should create or update a
`nightly-failure` issue.

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
