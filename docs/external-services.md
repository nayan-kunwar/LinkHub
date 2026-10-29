# External services and technology inventory

Status: active.

Last updated: 2026-10-28.

Last verified: 2026-10-28 (nightly trigger, production smoke checks, vendor usage review, Render workspace audit, edge/DNS and email DNS checks).

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
Vercel (Next.js 16 web, Server: Vercel)
  │  /api/* rewrite
  ▼
Render edge (Cloudflare, CF-RAY) ──► Render (Express 5 API) ──► Neon (PostgreSQL 18)
                                            │
                                            └──► Brevo (transactional email)

UptimeRobot ──► Render  /api/v1/health/live  every 5 min (keep-warm)
                    └──► /api/v1/health       every 30 min (readiness, queries Neon)

cron-job.org ──► GitHub Actions (nightly) ──► Neon
                                   └──► Healthchecks.io (success ping)

GitHub ──► Vercel and Render auto-deploy on `main`
Owner  ──► OneDrive (pg_dump backups)
```

Cloudflare is not configured by the owner. `link.nayankunwar.com` and the apex
are served directly by Vercel; the only Cloudflare hop is Render's own edge for
`onrender.com`, confirmed from live response headers on 2026-10-28. Authoritative
DNS is the registrar's (`*.dns-parking.com`), not Cloudflare's.

When Google sign-in or sign-up is enabled, the browser also loads Google Identity
Services from `accounts.google.com`. The API verifies the returned Google ID
token with Google's JWKS. No Google client secret is used or stored. The feature
is dark by default until both Google client-ID environment variables are set;
Google account creation additionally requires `ALLOW_SIGNUP=true`.

## Dashboard links

Direct links for the recurring checks. These are owner-only vendor consoles; no
credentials are stored in this repository.

| Service | Link | What to check |
|---|---|---|
| Render billing | `https://dashboard.render.com/billing#included-usage` | Free instance hours, bandwidth, services, custom domains, pipeline minutes |
| Render service | `https://dashboard.render.com/web/srv-dbfgvptg1s2s73fpimkg` | Deploys, logs, environment, custom domains |
| Render metrics | `https://dashboard.render.com/web/srv-dbfgvptg1s2s73fpimkg/metrics` | Network; memory/CPU are paid-only |
| Vercel usage | `https://vercel.com/nayan-kunwars-projects/link-hub/usage` | Fast data/origin transfer, CDN requests, ISR reads/writes |
| Neon console | `https://console.neon.tech/app/projects/damp-frost-53091995` | Compute hours, storage, history, PostgreSQL version |
| Brevo | `https://app.brevo.com/` | Email quota, senders, domain authentication |
| cron-job.org | `https://cron-job.org/en/members/jobs/` | Job `8732512`, execution history, next run |
| Healthchecks.io | `https://healthchecks.io/` | `LinkHub nightly analytics` check, pings, grace period |
| UptimeRobot | `https://dashboard.uptimerobot.com/` | Liveness and readiness monitors |
| GitHub Actions | `https://github.com/nayan-kunwar/LinkHub/actions/workflows/analytics-nightly.yml` | Nightly runs and heartbeat step |
| GitHub repository | `https://github.com/nayan-kunwar/LinkHub` | Code, issues, Actions secrets |

## Runtime services

| Service | Role and purpose | Plan and limits | Configured in | If it fails |
|---|---|---|---|---|
| **Vercel** | Hosts the Next.js 16 web app at `link.nayankunwar.com`; serves the marketing page and public profiles with ISR/CDN caching; rewrites `/api/*` to the Render API; receives `/internal/revalidate` calls from the API | **Hobby:** 100 GB fast data transfer, 10 GB fast origin transfer, 1M CDN requests, 1 h CDN request CPU, 1M ISR reads, 200k ISR writes, 1M function invocations, 4 CPU-hours, 360 GB-hours per month. Hobby is **non-commercial only**. | Vercel project (`apps/web` root); env `API_BASE_URL`, `NEXT_PUBLIC_APP_URL`, `ROOT_MODE`, `NEXT_PUBLIC_ALLOW_SIGNUP`, and the three shared secrets | Site is down. The API is still reachable at its Render URL, but the browser app and same-origin `/api/*` calls fail. |
| **Render** | Hosts the Express 5 API; runs schema-compatible code from `main`; exposes `/api/v1/health/live` as the Render health check; auto-deploys on commit | **Free:** 750 instance-hours/month **shared across the workspace**, 5 GB outbound bandwidth, 512 MB RAM, 0.15 CPU (service dashboard), 25 services, 2 custom domains, 500 pipeline minutes. Sleeps after 15 minutes idle; cold start measured at **57.1 s**; no cron jobs or pre-deploy commands. Memory/CPU metrics are paid-only. Render's free plan is **not documented for production**. | `render.yaml` plus Render dashboard env vars. A build filter ignores `**/*.md`, `docs/**`, `apps/web/**` and `.github/**`, so docs and web-only commits do not restart the API. | API returns 502/timeout or cold-starts. Auth, dashboard, analytics, export and contact are unavailable. Cached public profiles may still render from Vercel. |
| **Neon** | Managed PostgreSQL 18 in Singapore; stores users, profiles, links, categories, sessions, verification tokens, click events and rollups | **Free:** 100 CU-hours/project/month, 1 GB storage, 6-hour history window, one manual snapshot, **no full PITR**. Compute scales to zero after about 5 minutes idle. | Neon console; `DATABASE_URL` (pooled) and `DIRECT_URL` (direct) on Render and in GitHub Actions secrets | Writes fail and readiness returns `503`. Cached public profiles may still render. Recovery is the latest off-machine `pg_dump`, not PITR. |
| **Brevo** | Transactional email: signup verification, password reset, email-change verification, account-restore links, contact-form delivery to the owner, and throttled API 5xx alerts | **Free:** 300 emails/day, shared by all flows. | Render env `EMAIL_PROVIDER=brevo`, `EMAIL_BREVO_API_KEY`, `EMAIL_FROM`; domain authentication records in Hostinger DNS (Brevo code TXT, DKIM CNAMEs, DMARC; no apex SPF) | Verification, reset, email change, restore, contact and 5xx alerts stop. Signup and recovery are effectively blocked. |
| **Google Identity Services** | Optional Google sign-in and Google-first sign-up. The browser receives a Google ID token; the API verifies it with Google's JWKS, signs in a linked Google subject, or returns one editable username claim for a new account. Existing emails are never auto-linked. No Google access token or client secret. | Free. OAuth consent screen in Testing mode for the private phase; publish before public Google sign-up. | Google Cloud Console Web OAuth client; Render `GOOGLE_CLIENT_ID`; Vercel `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (same value); `ALLOW_SIGNUP`/`NEXT_PUBLIC_ALLOW_SIGNUP=true` for account creation | Google sign-in returns `503 GOOGLE_SIGN_IN_DISABLED` or the button is hidden. Password sign-in and linked-account management continue to work. |
| **Cloudflare** | Render's upstream edge for `onrender.com`: terminates TLS and adds the Cloudflare HTTP layer in front of the API. It is **not** an owner-configured zone and does not sit in front of Vercel. | Part of Render's infrastructure; no account, plan or quota of ours. | Not in this repository. Confirmed 2026-10-28 from live headers: the API returns `server: cloudflare`, `cf-ray` and `x-render-origin-server: Render`, while `link.nayankunwar.com` returns `server: Vercel` with no `cf-ray`. | Render's edge changes or is bypassed. Re-verify `TRUST_PROXY=3` and the trusted country header (`WEB_PROXY_SECRET`) before changing either. |
| **Hostinger** | Domain registration for `nayankunwar.com` and the authoritative DNS zone (nameservers `nebula.dns-parking.com` / `aurora.dns-parking.com`): apex and `link` CNAME to Vercel, plus Brevo DKIM CNAMEs and DMARC (no apex SPF) | Paid domain/DNS; not a free tier. | Hostinger → Domains → `nayankunwar.com` → DNS / DNS Zone | DNS resolution and HTTPS fail for `link.nayankunwar.com`; Brevo domain authentication breaks if the records are removed. |

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
| Data | PostgreSQL 18 on Neon (PostgreSQL 16 for local dev), Prisma 6, `connect-pg-simple` | Persistence, typed queries/migrations, Postgres-backed sessions |
| Auth and security | `express-session`, argon2id, `jose` (Google ID-token/JWKS verification), Helmet, `express-rate-limit`, CSRF/Origin checks | Sessions, password hashing, optional Google sign-in, headers, throttling and mutation protection |
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
| `GOOGLE_CLIENT_ID` | API | Render env | Not a secret: the public Web OAuth client ID. Optional; unset disables Google sign-in and sign-up. Must match the Vercel value. |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Web | Vercel env | Not a secret: the same public client ID, inlined at build time. Optional; unset hides the Google button. |
| `NEXT_PUBLIC_ALLOW_SIGNUP` | Web | Vercel env | Build-time UI flag for `/signup`; must be `true` for the Google entry screen to render. The API's `ALLOW_SIGNUP` remains the security boundary. |
| `EMAIL_BREVO_API_KEY` | API | Render env | Rotate in Brevo → SMTP & API → API Keys. |
| `HEARTBEAT_URL` | Nightly workflow | GitHub Actions secret | Recreate the Healthchecks check or ping URL, then update the secret. |
| GitHub fine-grained PAT | cron-job.org | cron-job.org job header only | `LinkHub` only, **Actions: Read and write**, expires **2027-01-25 07:08 UTC**. Rotate before expiry. |

## Free-tier and vendor-policy watch

| Vendor | Free limit | What to watch | Policy note |
|---|---|---|---|
| Render | 750 instance-hours/month (workspace-wide), 5 GB outbound, 512 MB RAM, 25 services, 2 custom domains, 500 pipeline minutes | One always-on API uses about 730 hours. The 2026-10-28 audit reduced the workspace from 12 to 8 services: 4 deleted, 2 suspended, 6 active — **all six active are Free**. LinkHub still shares the 750-hour pool with five other free web services; 24/7 leaves only 6-30 hours. Suspend the other five or isolate LinkHub. Observed 2026-10-28: 231.83 hours, 334 MB, 2/2 domains. | Free instances are not documented for production. |
| Vercel | 100 GB fast data transfer, 10 GB fast origin transfer, 1M CDN requests, 1 h CDN CPU, 1M ISR reads, 200k ISR writes | Observed 2026-10-28: 49.24 MB fast data transfer and 6,034 CDN requests. Public profile HTML is rendered per request; profile data is cached for 300 s. | Hobby is non-commercial only. A public multi-tenant service likely needs Pro or another host. |
| Neon | 100 CU-hours/project/month, 1 GB storage, 6-hour history, one snapshot | Observed 2026-10-28: 5.46 CU-hrs and 32.97 MB storage. Recheck after a week of normal traffic; 5-minute readiness checks would use ~182 CU-hours/month. | No full PITR. The off-machine logical dump is the recovery path. |
| Brevo | 300 emails/day | Observed 2026-10-28: 300 available (0 used). Signup, verification, reset, email change, restore, contact and 5xx alerts share the quota. | Watch **Statistics** after any signup spike. |
| UptimeRobot | 50 monitors, 5-minute interval | Two monitors: liveness every 5 min, readiness every 30 min. | Heartbeat monitoring is paid; Healthchecks.io covers that gap. |
| GitHub Actions | 2,000 minutes/month for private repositories | Nightly job uses about 30 minutes/month. | A workflow failure opens or updates the `nightly-failure` issue. |
| cron-job.org | 60 executions/hour, 30 s request timeout | One dispatch per day at 03:17 UTC. | The dispatch returns immediately; the timeout does not apply to the job runtime. |
| Healthchecks.io | 20 checks, 100 log entries per check | One check for the nightly job. | A daily ping keeps roughly three months of history. |
| Hostinger | Paid domain/DNS | Domain renewal and DNS records. | Not a free tier; losing the domain breaks web and email. |
| OneDrive | Personal storage | Backup retention and sync status. | Not an application dependency, but it is the off-machine recovery copy. |

## Usage snapshot — 2026-10-28

Observed in the vendor dashboards. Vercel covers the last 30 days through
2026-10-27; Render is the current calendar month; Neon is since project creation
on 2026-10-26; Brevo is the current daily allowance.

| Vendor | Metric | Observed | Limit | Used |
|---|---|---|---|---|
| Vercel | Fast data transfer | 49.24 MB | 100 GB | ~0.05% |
| Vercel | Fast origin transfer | 21.96 MB | 10 GB | ~0.21% |
| Vercel | CDN requests | 6,034 | 1,000,000 | ~0.60% |
| Vercel | CDN request CPU | 3 s | 1 h | ~0.08% |
| Vercel | ISR reads | 1,990 | 1,000,000 | ~0.20% |
| Vercel | ISR writes | 373 | 200,000 | ~0.19% |
| Vercel | Data cache | 140 reads / 65 writes | no published cap | — |
| Render | Free instance hours | 231.83 h | 750 h/month | 30.9% |
| Render | Bandwidth | 334 MB | 5 GB | 6.5% |
| Render | Custom domains | 2 | 2 | 100% |
| Render | Services | 12 at capture; 8 after cleanup | 25 | 48% → 32% |
| Render | Pipeline minutes | 34 min | 500 min | 6.8% |
| Neon | Compute | 5.46 CU-hrs | 100 CU-hrs/month | 5.5% |
| Neon | Storage | 32.97 MB | 1 GB | 3.2% |
| Neon | History | 4.25 MB | 1 GB | ~0.4% |
| Neon | Network transfer | 5.19 MB | — | — |
| Brevo | Emails available | 300 | 300/day | 0 used at capture |

**Interpretation**

- **Render instance hours are the binding constraint.** The 750-hour allowance
  is workspace-wide. The 2026-10-28 audit reduced the workspace from 12 to 8
  services: 4 deleted, 2 suspended, 6 active. **All six active services are on
  the Free plan**, so LinkHub still shares the pool with five other free web
  services. A full 24/7 month at the current keep-warm cadence is roughly
  720-744 hours, leaving ~30 hours in November and ~6 hours in December. Any
  other free service that wakes for more than the remaining margin can exhaust
  the workspace, and Render then suspends **all** free web services, including
  LinkHub. Suspend the five non-LinkHub free services or move LinkHub to a
  dedicated workspace before public launch.
- **Render bandwidth is 334 MB, not the 10 MB shown on the Metrics page.** The
  billing page includes service-initiated traffic (314 MB) plus HTTP responses
  (20 MB). Still 6.5% of 5 GB.
- **Render custom domains are at 2/2.** A custom API domain would require
  removing an existing domain or upgrading.
- **Render Free does not expose memory or CPU metrics.** The 512 MB / 0.15 CPU
  limits are enforced; watch restarts, 502s and slow responses instead.
- **Neon compute projects to ~85 CU-hours/month** if the first 46 hours are
  representative. That is probably inflated by migrations, seeding and the
  2026-10-27 smoke tests; recheck after a week of normal traffic. Storage and
  history are well under 1 GB.
- **Vercel and Brevo have large headroom.** Brevo's 300/day is the first limit
  to hit if public signup opens.

## Dormant or test-only integrations

These are implemented or mentioned but are **not** active production
dependencies. They are listed so they are not mistaken for live services.

| Item | Status | Note |
|---|---|---|
| Google sign-in and sign-up | Built, dark by default | Sign-in is limited to linked accounts; sign-up is Google-first with one user-confirmed username and requires `ALLOW_SIGNUP=true`. No email auto-link. Enabled only when `GOOGLE_CLIENT_ID` and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` are set. |
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
| 2026-10-28 | Vendor usage review | Vercel, Render, Neon and Brevo within limits; Render workspace had 12 services at capture (8 after cleanup) and 2/2 custom domains; see **Usage snapshot** above |
| 2026-10-28 | Render workspace audit | 12 → 8 services: 4 deleted (movie-recommendation-backend, ChilChat, community-connect-backend, real-time-polling-backend), 2 suspended (QuipShop-Backend, web-rtc), 6 active and all Free (linkhub-api, anveshan, shrutilipi-backend, payonce…, nearby-friends, shortly). LinkHub still shares the 750-hour pool; suspend the other five or isolate LinkHub. |
| 2026-10-28 | Edge and DNS check | `link.nayankunwar.com` and the apex return `server: Vercel` with no `cf-ray`; the Render API returns `server: cloudflare`, `cf-ray` and `x-render-origin-server: Render`. Nameservers are `nebula.dns-parking.com` / `aurora.dns-parking.com`. Cloudflare is Render's edge, not an owner-configured zone. |
| 2026-10-28 | Render build filter | `render.yaml` now ignores `**/*.md`, `docs/**`, `apps/web/**` and `.github/**`. The blueprint sync restarted the API once; two later docs-only commits did not restart it (uptime 760 s at 12:18:43 UTC). |
| 2026-10-28 | Email DNS check | Apex TXT has `google-site-verification` and `brevo-code`, no SPF. DKIM CNAMEs `brevo1._domainkey` / `brevo2._domainkey` resolve to Brevo keys; `_dmarc` is `p=none` with Brevo reporting. SPF is optional for Brevo (DKIM alignment) and is recorded as a pre-signup item. |
| 2026-10-28 | Google sign-in implementation | GIS ID-token flow, explicit Settings linking, unique `(user_id, provider)` constraint, verifier/service/route tests. Feature stays dark until the owner creates a Web OAuth client and sets both client-ID env vars. |
| 2026-10-29 | Google sign-up implementation | `/signup` is Google-first with one editable username claim; `/auth/google/signup` creates an active, email-verified user only when `ALLOW_SIGNUP=true`; existing emails return `GOOGLE_ACCOUNT_EXISTS`; Google-only accounts can set a first password in Settings. Feature stays dark until the client IDs, signup flags and published consent screen are in place. |

Vendor checks and open items:

- [x] Vercel usage reviewed (2026-10-28): all metrics under 1% of Hobby limits.
- [x] Neon compute/storage reviewed (2026-10-28): 5.46 CU-hrs, 32.97 MB.
- [x] Brevo daily quota reviewed (2026-10-28): 300 available.
- [x] Render billing reviewed (2026-10-28): 231.83 instance hours, 334 MB, 2/2 domains.
- [x] Render workspace audit (2026-10-28): 12 → 8 services; 4 deleted, 2 suspended, 6 active, **all six Free**. LinkHub shares the 750-hour pool with five other free web services.
- [ ] Render free-hour isolation: suspend the five non-LinkHub free services or move LinkHub to a dedicated workspace before public launch.
- [x] Healthchecks.io check confirmed (2026-10-28): Cron `17 3 * * *`, timezone UTC, 2-hour grace, email notification ON.
- [ ] Publish an apex SPF record (`v=spf1 include:spf.brevo.com ~all`) before public signup; DKIM (two CNAMEs) and DMARC (`p=none`) are already live. Only add SPF if nothing else sends from the domain.
- [x] Cloudflare documented as Render's edge, not a configured service (2026-10-28): web responses are `server: Vercel` with no `cf-ray`; only the API shows Cloudflare headers. Nameservers are the registrar's `*.dns-parking.com`.

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
