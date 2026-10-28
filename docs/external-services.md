# External services and technology inventory

Status: active.

Last updated: 2026-10-28.

Last verified: 2026-10-28 (nightly trigger and production smoke checks).

This document is the single inventory of every external service and major
technology LinkHub depends on. For each entry it records the role, the plan and
limits, where it is configured, and what breaks if it is unavailable. It is a
registry, not a deployment runbook: step-by-step instructions live in
[`DEPLOYMENT.md`](../DEPLOYMENT.md).

Do not record secret values, account passwords, audit findings, or customer data
here. Secret names and storage locations are listed in
[Secrets register](#secrets-register).

## Request and operations path

```text
Browser
  │
  ▼
Cloudflare edge (observed)
  │
  ▼
Vercel (Next.js 16 web) ── /api/* rewrite ──► Render (Express 5 API) ──► Neon (PostgreSQL 16)
                                                        │
                                                        └──► Brevo (transactional email)

UptimeRobot ──► Render  /api/v1/health/live  every 5 min (keep-warm)
                    └──► /api/v1/health       every 30 min (readiness, queries Neon)

cron-job.org ──► GitHub Actions (nightly) ──► Neon
                                   └──► Healthchecks.io (success ping)

GitHub ──► Vercel and Render auto-deploy on `main`
Owner  ──► OneDrive (pg_dump backups)
```

## Runtime services

| Service | Role and purpose | Plan and limits | Configured in | If it fails |
|---|---|---|---|---|
| **Vercel** | Hosts the Next.js 16 web app at `link.nayankunwar.com`; serves the marketing page and public profiles with ISR/CDN caching; rewrites `/api/*` to the Render API; receives `/internal/revalidate` calls from the API | **Hobby:** 100 GB fast data transfer, 1M function invocations, 4 CPU-hours, 360 GB-hours per month. Hobby is **non-commercial only**. | Vercel project (`apps/web` root); env `API_BASE_URL`, `NEXT_PUBLIC_APP_URL`, `ROOT_MODE`, `NEXT_PUBLIC_ALLOW_SIGNUP`, and the three shared secrets | Site is down. The API is still reachable at its Render URL, but the browser app and same-origin `/api/*` calls fail. |
| **Render** | Hosts the Express 5 API; runs schema-compatible code from `main`; exposes `/api/v1/health/live` as the Render health check; auto-deploys on commit | **Free:** 750 instance-hours/month, 5 GB outbound bandwidth, 512 MB RAM. Sleeps after 15 minutes idle; cold start measured at **57.1 s**; no cron jobs or pre-deploy commands. Render's free plan is **not documented for production**. | `render.yaml` plus Render dashboard env vars | API returns 502/timeout or cold-starts. Auth, dashboard, analytics, export and contact are unavailable. Cached public profiles may still render from Vercel. |
| **Neon** | Managed PostgreSQL 16 in Singapore; stores users, profiles, links, categories, sessions, verification tokens, click events and rollups | **Free:** 100 CU-hours/project/month, 1 GB storage, 6-hour history window, one manual snapshot, **no full PITR**. Compute scales to zero after about 5 minutes idle. | Neon console; `DATABASE_URL` (pooled) and `DIRECT_URL` (direct) on Render and in GitHub Actions secrets | Writes fail and readiness returns `503`. Cached public profiles may still render. Recovery is the latest off-machine `pg_dump`, not PITR. |
| **Brevo** | Transactional email: signup verification, password reset, email-change verification, account-restore links, contact-form delivery to the owner, and throttled API 5xx alerts | **Free:** 300 emails/day, shared by all flows. | Render env `EMAIL_PROVIDER=brevo`, `EMAIL_BREVO_API_KEY`, `EMAIL_FROM`; domain authentication records in Hostinger DNS | Verification, reset, email change, restore, contact and 5xx alerts stop. Signup and recovery are effectively blocked. |
| **Cloudflare** | Edge proxy observed in front of Render; part of the TLS and request path | Not configured in this repository. Treated as part of the upstream path. | Not in the repo. Verified indirectly with the `X-Forwarded-For` probe on 2026-10-26. | The proxy chain changes. `TRUST_PROXY=3` and the trusted country header (`WEB_PROXY_SECRET`) must be re-verified. |
| **Hostinger** | Domain registration for `nayankunwar.com` and the authoritative DNS zone: `link` CNAME to Vercel, plus Brevo SPF, DKIM and DMARC records | Paid domain/DNS; not a free tier. | Hostinger → Domains → `nayankunwar.com` → DNS / DNS Zone | DNS resolution and HTTPS fail for `link.nayankunwar.com`; Brevo domain authentication breaks if the records are removed. |

## Operations, CI and recovery services

| Service | Role and purpose | Plan and limits | Configured in | If it fails |
|---|---|---|---|---|
| **UptimeRobot** | Two HTTP monitors: `/api/v1/health/live` every **5 minutes** keeps Render warm and does not touch Postgres; `/api/v1/health` every **30 minutes** checks readiness and therefore Neon | **Free:** 50 monitors, 5-minute minimum interval. No heartbeat/dead-man's-switch monitoring on Free. | UptimeRobot dashboard | No uptime or readiness alerts. Render may sleep, so the first request after idle can take 30–60 s or exceed the Vercel proxy timeout. |
| **cron-job.org** | Dispatches the nightly GitHub Actions workflow daily at **03:17 UTC** with a fine-grained GitHub PAT. Replaced GitHub's unreliable `schedule` trigger. | **Free:** up to 60 executions/hour, 30 s request timeout. One dispatch per day. | cron-job.org job `LinkHub nightly analytics`, ID `8732512` | The nightly job does not start. Healthchecks.io alerts at about 05:17 UTC; cron-job.org also emails on a non-2xx dispatch. |
| **Healthchecks.io** | Dead-man's switch for the nightly job. The workflow pings it only after a successful run; a missing ping triggers an owner email. | **Hobbyist:** 20 checks, 100 log entries per check. One check is used. | Healthchecks.io dashboard; `HEARTBEAT_URL` GitHub Actions secret | No missed-run alert. The job still runs if the dispatch and workflow are healthy. |
| **GitHub** | Source repository, pull requests, issue tracker, and the `nightly-failure` alert issue. Also the source of truth for Vercel and Render auto-deploys. Owns the fine-grained PAT used by cron-job.org. | **Free private repository:** 2,000 Actions minutes/month. | GitHub repository `nayan-kunwar/LinkHub`; repository Actions secrets | Pushes stop deploying. The nightly workflow cannot be dispatched. Failure issues cannot be opened. |
| **GitHub Actions** | Runs the nightly analytics rollup/prune job and the success-only heartbeat ping. Keeps the job off Render's free plan. | Uses about **30 minutes/month** of the 2,000-minute private-repo allowance. | `.github/workflows/analytics-nightly.yml` | Nightly rollups and pruning stop. Healthchecks alerts; the workflow failure step cannot open an issue if GitHub itself is down. |
| **OneDrive** | Off-machine storage for `pg_dump --format=custom` backups and their metadata sidecars. This is the recovery path because Neon Free has no full PITR. | Personal storage; not part of the application runtime. | Owner's `C:\Users\nayan\OneDrive\LinkHub Backups` folder | The off-machine copy is lost. Local dumps may remain, but the recovery posture is weakened until a new dump is stored elsewhere. |

## Technology stack

These are self-hosted libraries and runtimes, not vendor accounts. They are
listed here so the inventory is complete and version upgrades have one place to
start.

| Layer | Technology | Purpose |
|---|---|---|
| Web framework | Next.js 16 (App Router), React 19, TypeScript | Marketing page, public profiles, auth/dashboard UI, ISR and `/api/*` rewrite |
| Styling and UI | Tailwind CSS 4, shadcn/ui, Radix UI primitives, Lucide icons, sonner | Design system, accessible dialogs/menus/tabs/tooltips, icons and toasts |
| Interaction | dnd-kit, react-hook-form, Zod, Recharts | Link/category reordering, forms and validation, analytics charts |
| API | Express 5, TypeScript, Zod | REST API, request validation and shared schemas |
| Data | PostgreSQL 16, Prisma 6, `connect-pg-simple` | Persistence, typed queries/migrations, Postgres-backed sessions |
| Auth and security | `express-session`, argon2id, Helmet, `express-rate-limit`, CSRF/Origin checks | Sessions, password hashing, headers, throttling and mutation protection |
| Logging | Pino, `pino-http` | Structured JSON logs, request IDs, redaction and audit events |
| Export | JSZip | CSV export archive |
| Runtime and tooling | Node.js 22, pnpm 11, tsup, tsx | Runtime, workspace management, API bundling and scripts |
| Testing | Vitest, Supertest | Unit and HTTP integration tests |
| Fonts | Inter via `next/font/google` | Fetched at build time and self-hosted by Next.js; no runtime request to Google |

## Secrets register

Names and locations only. Values live in the vendor dashboards and must never be
committed to this repository.

| Secret | Used by | Stored in | Rotation note |
|---|---|---|---|
| `DATABASE_URL` | API, nightly job | Render env, GitHub Actions secret | Rotate with the Neon role password. Pooled URL; keep `pgbouncer=true` and `connection_limit=5`. |
| `DIRECT_URL` | Migrations, nightly job | Render env, GitHub Actions secret | Rotate with the Neon role password. Direct, non-pooled URL. |
| `SESSION_SECRET` | API | Render env | Rotating invalidates existing sessions. |
| `REVALIDATE_SECRET` | API and web | Render env, Vercel env | Must be identical on both; rotate together. |
| `INTERNAL_FETCH_TOKEN` | API and web | Render env, Vercel env | Must be identical on both; rotate together. |
| `WEB_PROXY_SECRET` | API and web | Render env, Vercel env | Must be identical on both; gates the trusted country header. |
| `ANALYTICS_HASH_SECRET` | API | Render env | Keyed daily click-dedupe hash. Rotating it only affects future dedupe windows; no historical linkage. |
| `EMAIL_BREVO_API_KEY` | API | Render env | Rotate in Brevo → SMTP & API → API Keys. |
| `HEARTBEAT_URL` | Nightly workflow | GitHub Actions secret | Recreate the Healthchecks check or ping URL, then update the secret. |
| GitHub fine-grained PAT | cron-job.org | cron-job.org job header only | `LinkHub` only, **Actions: Read and write**, expires **2027-01-25 07:08 UTC**. Rotate before expiry. |

## Free-tier and vendor-policy watch

| Vendor | Free limit | What to watch | Policy note |
|---|---|---|---|
| Render | 750 instance-hours/month, 5 GB outbound, 512 MB RAM | One always-on API uses about 730 hours, leaving ~20. A second free service would exceed the allowance. | Free instances are not documented for production. |
| Vercel | 100 GB fast data transfer, 1M invocations, 4 CPU-hours, 360 GB-hours | Public profile HTML is rendered per request; profile data is cached for 300 s. | Hobby is non-commercial only. A public multi-tenant service likely needs Pro or another host. |
| Neon | 100 CU-hours/project/month, 1 GB storage, 6-hour history, one snapshot | Readiness checks and traffic keep compute awake. 5-minute readiness checks would use ~182 CU-hours/month. | No full PITR. The off-machine logical dump is the recovery path. |
| Brevo | 300 emails/day | Signup, verification, reset, email change, restore, contact and 5xx alerts share the quota. | Watch **Statistics** after any signup spike. |
| UptimeRobot | 50 monitors, 5-minute interval | Two monitors: liveness every 5 min, readiness every 30 min. | Heartbeat monitoring is paid; Healthchecks.io covers that gap. |
| GitHub Actions | 2,000 minutes/month for private repositories | Nightly job uses about 30 minutes/month. | A workflow failure opens or updates the `nightly-failure` issue. |
| cron-job.org | 60 executions/hour, 30 s request timeout | One dispatch per day at 03:17 UTC. | The dispatch returns immediately; the timeout does not apply to the job runtime. |
| Healthchecks.io | 20 checks, 100 log entries per check | One check for the nightly job. | A daily ping keeps roughly three months of history. |
| Hostinger | Paid domain/DNS | Domain renewal and DNS records. | Not a free tier; losing the domain breaks web and email. |
| OneDrive | Personal storage | Backup retention and sync status. | Not an application dependency, but it is the off-machine recovery copy. |

## Dormant or test-only integrations

These are implemented or mentioned but are **not** active production
dependencies. They are listed so they are not mistaken for live services.

| Item | Status | Note |
|---|---|---|
| Resend | Dormant | The mailer supports `EMAIL_PROVIDER=resend`, but production uses Brevo. No Resend key is configured. |
| Console mail transport | Development only | Writes to `apps/api/.mail-outbox`. Production validation rejects it unless `ALLOW_CONSOLE_MAIL_IN_PRODUCTION=true`, which must not be enabled on the public site. |
| mail.tm / maxxspace.com | Test only | Temporary inboxes used to verify email delivery and the email-change flow. Not part of the product. |
| Cloudflare Pages | Not used | Considered as a Vercel alternative in the architecture; the web app runs on Vercel. |
| Docker | Local tooling | Used to run `pg_dump`/`pg_restore` and a throwaway PostgreSQL container for restore verification. Not a production service. |

## Verification log

| Date (UTC) | Check | Result |
|---|---|---|
| 2026-10-27 | Cold start through the Vercel rewrite after ~20 minutes idle | 57.1 s first request; 0.72 s readiness and 0.37 s liveness when warm |
| 2026-10-27 | Keep-warm monitor | `uptime` reached 1,356 s with no manual requests; 5-minute liveness monitor kept Render awake |
| 2026-10-27 | Nightly workflow, manual run `40463090302` | Success; `Ping heartbeat` succeeded |
| 2026-10-27 | cron-job.org test dispatch | `200 OK`; created run `40467931426`, which succeeded and pinged the heartbeat |
| 2026-10-28 | First automatic cron-job.org dispatch | Run `40625796861` started at **03:17:05 UTC** and succeeded; `Ping heartbeat` succeeded; failure step skipped |
| 2026-10-28 | Production pages and API | `/`, `/nayankunwar`, `/login`, `/contact`, `/terms`, `/privacy`, `/robots.txt`, `/sitemap.xml` returned 200; API health returned 200 |

Still to confirm in the vendor dashboards:

- [ ] Healthchecks.io check uses Cron `17 3 * * *`, timezone UTC, 2-hour grace.
- [ ] Render, Vercel, Neon and Brevo usage dashboards reviewed for the current month.
- [ ] Cloudflare is documented as an observed edge rather than a configured service, unless the owner confirms otherwise.

## Maintenance

- Update this document whenever a service is added or removed, a plan changes,
  a credential is rotated, or a vendor policy changes.
- Review the free-tier table quarterly and after any traffic spike.
- Update **Last updated** and **Last verified** at the top.
- Keep secret **values** out of this file. Record only names and storage
  locations.
- When a service is retired, move it to
  [Dormant or test-only integrations](#dormant-or-test-only-integrations) and
  record the date and replacement.

## Related

- [`DEPLOYMENT.md`](../DEPLOYMENT.md) — deployment order, environment variables, monitoring and backup runbook.
- [`link-hub-architecture.md`](../link-hub-architecture.md) — §3 tech stack, §15 observability, §17 deployment and §18.1 free-tier review.
- [`docs/nightly-analytics-trigger.md`](nightly-analytics-trigger.md) — cron-job.org → GitHub Actions → Healthchecks.io runbook.
- [`render.yaml`](../render.yaml) — Render Blueprint for the API.
- [`.github/workflows/analytics-nightly.yml`](../.github/workflows/analytics-nightly.yml) — nightly workflow definition.
