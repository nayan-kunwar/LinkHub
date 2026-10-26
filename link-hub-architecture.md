# Link Hub — Architecture & Implementation Specification

**Version:** 2.4
**Owner:** Nayan Kunwar (Backend Engineer, Node.js/TypeScript)
**Domain:** `nayankunwar.com` · Web `link.nayankunwar.com` · API `api.nayankunwar.com` (reached by browsers only through the same-origin `/api/*` rewrite)
**Status:** Owner-first, multi-tenant by design

---

## Changelog

**v2.4 prototype parity, account lifecycle & breakdowns**

- **Profile & appearance:** profile gains `headline` (80 chars) and a validated `socials` JSON object (`website`, `github`, `linkedin`, `x`, `medium`, `email` as `mailto:`); `theme` JSON stores the full appearance settings (theme preset, primary color, background, card and button styles, avatar/bio/social/description visibility).
- **Categories & links:** categories gain `description` (80), `color` (six-digit hex), `icon` (fixed icon set) and `is_visible`; links gain an optional `icon` (fixed icon set). Category visibility hides its links from the public profile without deleting them.
- **Account lifecycle:** self-serve `DELETE /account` schedules deletion with a 30-day grace period (`users.deletion_scheduled_for`), unpublishes the profile immediately and revokes other sessions. Signing in or opening the emailed `/restore-account?token=…` link clears the schedule; restoring does **not** republish. A purge job hard-deletes after the grace period.
- **Email change:** `PATCH /account/email` stores `users.pending_email` and issues a 24-hour `email_change` token to the new address; the email changes only after verification. Password change revokes all other sessions; sessions are listed and revocable individually or all at once.
- **Analytics:** `click_events.country_code` (two-letter ISO code, never an IP) is added. A new `click_daily_breakdowns` rollup stores daily `country`, `device` and `referrer` dimensions. The nightly job order is now totals → breakdowns → clear hashes → purge raw → prune.
- **Country trust:** the API trusts `x-vercel-ip-country` only when the request carries a valid `WEB_PROXY_SECRET` header added by the web tier; otherwise `country_code` is null. No IP is ever stored or logged.
- **Export v2:** JSON uses `schemaVersion: 2`; CSV export is a zip of five files — `profile.csv`, `links.csv`, `categories.csv`, `daily_stats.csv`, `daily_breakdowns.csv`. Cells beginning with `= + - @`, tab or CR are prefixed with `'`.
- **Limits & auth copy:** 50 links, 20 categories, password 12–128 chars, 7-day sessions, 1-hour reset tokens, 24-hour verification/email-change tokens, 30-day deletion grace. Analytics days are UTC and the UI says so.
- **Routes & UI:** added `/check-inbox`, `/settings`, `/restore-account`, `/preview` (demo-only), `/terms`, `/privacy`, root `not-found`, and the public `/[username]` page. `/dashboard/**` and `/settings/**` are guarded by Next.js 16 `proxy.ts`. `check-inbox` and `restore-account` are reserved usernames.
- **UI-first milestone:** the production Next.js UI is built against typed mocks and covers every approved prototype screen; the Express API, Prisma schema and real session wiring are the next phase. Mock auth accepts any password except `wrong`, and `/preview` is disabled outside demo mode.

**v2.3 correctness, security & operations fixes**

- Analytics: the beacon now sends `document.referrer` (host only) because the request `Referer` is the profile page itself; `referrer_host` is no longer derived from the request header.
- Analytics: raw `click_events` retention is now 90 days (`rawEventRetentionDays`), while `click_daily_stats` remain for the life of the link; added `click_events(clicked_at)` and partial hash-clear indexes.
- Analytics: nightly job now uses one run-level advisory lock on a direct connection (or a `job_state` row lock); first-run watermark bootstrap, a retention/lookback guard against re-rolling purged days, and batched `ctid` deletes are specified.
- Analytics: composite FKs `(link_id, user_id) → links(id, user_id)` added to `click_events` and `click_daily_stats`; `links` gets `@@unique([id, user_id])`.
- Click endpoint: rate-limit, Origin, body-parser, and validation failures on `/analytics/clicks` all return `204`; the click route has route-specific error handling.
- Auth: CSRF/Origin checks now cover all non-GET requests, including login/register/forgot/reset; tokens are consumed atomically; password max length and dummy-hash timing behavior are specified.
- Sessions: the Prisma `Session` model now mirrors `connect-pg-simple` (`json`, `timestamp(6)`, `varchar(255)`), `createTableIfMissing: false`, and the `sess->>'userId'` expression index is required.
- ISR: API→web revalidation is awaited with a timeout; Next.js 16 `proxy.ts` and `revalidateTag` semantics are explicit; public profile fetches use a shared internal token and cacheable response headers.
- Caching/CSRF: public profile, availability and click routes are mounted before the session middleware, so cacheable responses cannot carry `Set-Cookie`; `GET /auth/csrf` issues the readable signed double-submit cookie.
- Deployment: Vercel→Render cold-start/proxy-timeout risk, `TRUST_PROXY` example, Neon connection limits, vendor ToS, and staging/CI/test-DB requirements are documented.
- Security/abuse: theme/avatar validation, CSV-injection escaping, IPv6 rate-limit normalization, public DTO rules, expanded reserved usernames, and SEO/metadata/sitemap requirements added.
- Testing/ops: added tests for token races, CSRF on auth routes, click 204 paths, composite FKs, cache headers, ISR token, CSV injection, and theme/avatar validation; added error tracking/audit-log expectations.

**v2.2 analytics & health fixes**

- Single nightly analytics job with explicit, idempotent order (rollup → clear hashes → purge rolled-up raw events), advisory lock, `job_state` watermark table; dashboard reads rollups + not-yet-rolled-up raw events so totals never change after a purge (§11.3).
- Health endpoint is `/api/v1/health` (Express only receives `/api/*`); v2.3 adds `/api/v1/health/live` for Render liveness, while uptime monitoring uses the readiness endpoint.

**v2.2 security fixes**

- Category ownership on links: service checks via scoped repository (404 if not owned) **and** a composite FK `links(category_id, user_id) → categories(id, user_id)` with `ON DELETE NO ACTION`; category delete detaches links in the service transaction (composite `SetNull` would also null `user_id`).
- Visitor dedupe hash is now `HMAC-SHA256(dailyKey, ip|ua|linkId)` with an in-memory daily key derived from `ANALYTICS_HASH_SECRET`; hashes are short-lived.
- `TRUST_PROXY` must be verified from a real production request before launch; added verification procedure and warnings.

**v2.2 review fixes**

- Prisma enums rewritten in valid multi-line syntax; added datasource (`directUrl`, `citext` extension) and generator; added `User` relations for `ClickEvent`/`ClickDailyStat` (cascade); `sessions.user_id` removed (connect-pg-simple cannot populate it — user sessions are found via `sess->>'userId'`). Schema passes `prisma validate`; Mermaid diagrams render.
- Username regex fixed to enforce 3–30 chars (old pattern allowed 1 char).
- `FRONTEND_URL` removed; `APP_URL` is the single origin used for CORS, Origin/CSRF checks and email links.
- Proxy-aware client IP for rate limiting behind Vercel rewrite + Render; Set-Cookie without `Domain`.
- Clarified "no slugs" exclusion means link/redirect slugs; noted Next.js 16 `revalidateTag(tag, 'max')` and `middleware.ts` → `proxy.ts` rename; revalidate tag regex to be widened when multi-page ships.

**v2.1 → v2.2**

- Added **Later** feature: multiple link pages per user (`/:username/:pageSlug`). Design note only (§21.1); MVP schema and endpoints unchanged.

**v2.0 → v2.1**

- Product vision is now **multi-tenant**: every registered user manages their own profile, links, categories, appearance, analytics and exports.
- Public profiles move to **`link.nayankunwar.com/:username`**. Root `/` is governed by `ROOT_MODE` (`profile` → `DEFAULT_USERNAME` during private phase, `landing` at launch).
- Every feature is labeled **MVP**, **Public launch** (required before `ALLOW_SIGNUP=true`), or **Later** (deferred until explicitly approved).
- Added registration, email verification (`verification_tokens`, Brevo), password reset, and account-status checks (`pending_verification` / `active` / `suspended` / `deleted`) at login **and** on every authenticated request.
- Fixed the `sendBeacon` content-type problem: same-origin path, `text/plain` body, route-scoped `express.text()`, Zod parsing, always `204`.
- Defined secure ISR revalidation: Next.js route handler `POST /internal/revalidate`, HMAC-signed, timestamped, replay-protected, server-to-server only; tag `profile:<username>`; old username revalidated on rename.
- Added routing rules: reserved route list, Next.js route precedence, middleware order, `/api/*`-only rewrites, `no-store` on dashboard.
- Added "Private → Public release" section with launch checklist.
- Updated endpoints, Prisma schema, ER diagram, `.env.example`, tests, phases and AI-agent instructions. `ENABLE_PATH_PROFILES` removed (path profiles are always on).

---

## 1. Overview & Principles

Link Hub is a link-in-bio platform. Each user owns one public profile listing curated links, and a private dashboard to manage links, categories, appearance, analytics and exports. Visitors view published profiles without signing in.

It is built and used by the owner first, but the schema, authorization model and routing are multi-tenant from day one, so opening registration is a configuration and checklist exercise — not a rewrite.

**Principles**

1. **Tenant isolation is non-negotiable** — every owned row has `user_id`; every owned query is scoped in the repository layer; the client never supplies `user_id`.
2. **Build the seams, defer the features** — billing, OAuth, custom domains and advanced moderation are not built until explicitly approved.
3. **Direct links only** — anchors point at the original URL. No shortening, link/redirect slugs, redirect endpoints or QR codes.
4. **Best-effort, privacy-conscious analytics** — never on the navigation path; no raw IPs.
5. **Fast public pages** — ISR-cached and tag-revalidated; survive API cold starts.
6. **Simple, type-safe, free-tier friendly** — modular monolith, shared Zod schemas, minimal abstraction.

### Feature Tier Legend

| Tag | Meaning |
|---|---|
| **MVP** | Built now; used by the owner in the private phase |
| **Public launch** | Must be complete and verified before `ALLOW_SIGNUP=true` |
| **Later** | Deferred; documented seam only; not implemented until approved |

---

## 2. Scope

### 2.1 Features

| Feature | Tier | Notes |
|---|---|---|
| Public profile at `/:username` | MVP | Published profiles only; no login needed |
| Root `/` → `DEFAULT_USERNAME` profile | MVP | `ROOT_MODE=profile` |
| Root `/` → landing page | Public launch | `ROOT_MODE=landing` |
| Public profile SEO (metadata, canonical, OG, sitemap, robots) | Public launch | Published profiles only; unpublished/unknown profiles return 404 (noindex) |
| Accessibility baseline (keyboard, focus, contrast) | Public launch | Public pages + dashboard |
| Unique username + reserved-route validation | MVP | Availability check endpoint |
| Link CRUD, activate/deactivate, optional icon | MVP | Fixed icon set |
| Drag-and-drop ordering | MVP | Transactional reorder |
| Categories (CRUD, ordering, description, color, icon, visibility) | MVP | Hidden category links stay off the public page |
| Profile customization (name, headline, bio, avatar URL, socials, appearance) | MVP | URL-only avatar; validated `socials` JSON |
| Click analytics (beacon, bot filter, dedupe, country code) | MVP | Country from trusted proxy header only |
| Analytics dashboard (overview, per-link, timeseries, breakdowns) | MVP | Own links only; countries/devices/referrers |
| Search / filter links | MVP | |
| Export own data (JSON + five-CSV zip) | MVP | `schemaVersion: 2` |
| Responsive UI | MVP | |
| Login / logout, Postgres sessions | MVP | |
| Account email change (pending verification) | MVP | `pending_email` + `email_change` token |
| Password change & session management | MVP | Other sessions revoked on password change |
| Self-serve account deletion + restore | MVP | 30-day grace, `deletion_scheduled_for`, purge job |
| Owner seed script | MVP | |
| Centralized entitlements (`free` plan) | MVP | |
| Account-status check on login + every request | MVP | Enforced even in private phase |
| Registration endpoint | MVP (built, flag-off) → Public launch (enabled) | `ALLOW_SIGNUP` |
| Email verification (Brevo) | Public launch | `verification_tokens` |
| Password reset | Public launch | `verification_tokens` |
| ToS / Privacy pages, basic abuse report (email/form) | Public launch | |
| Landing page | Public launch | |
| Billing / paid plans | Later | Entitlements seam exists |
| OAuth (Google/GitHub) | Later | `accounts` table exists |
| Custom domains | Later | `custom_domains` table not migrated |
| Advanced moderation / admin console | Later | `role=admin` reserved |
| Safe Browsing URL screening | Later | |
| Redis, analytics queue, partitioning | Later | |
| Unique-visitor analytics | Later | Requires `unique_count` in `click_daily_stats`, computed before hashes are cleared |
| Timezone-aware analytics | Later | MVP dashboard is UTC and labels it |
| Multiple link pages per user (`/:username/:pageSlug`) | Later | Design note §21.1; MVP = one implicit default page per profile |

### 2.2 Explicit Exclusions (all tiers)

- **NO** URL shortening
- **NO** custom redirect slugs or `/go/:slug`-style redirect endpoints
- **NO** QR codes
- Note: future page slugs (§21.1) identify a user's content pages, not redirects; links still point directly at original URLs
- **NO** AI features
- **NO** billing until explicitly approved

---

## 3. Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 (App Router) + TypeScript, Tailwind CSS, shadcn/ui, Recharts |
| Backend | Express + TypeScript |
| Validation | Zod (shared in `packages/shared`) |
| Database | PostgreSQL on Neon (free tier) |
| ORM | Prisma |
| Auth | `express-session` + `connect-pg-simple`, argon2id |
| Email | Brevo (free tier) via a thin `mailer` module; console transport in dev |
| Testing | Vitest, Supertest, Playwright |
| Package manager | pnpm workspaces |

Auth.js/NextAuth is **not** used. The Express API is the single identity authority.

---

## 4. System Architecture

```mermaid
flowchart LR
    V[Visitor] -->|GET /:username| W[Next.js on Vercel<br/>ISR profile pages]
    U[Registered user] -->|/dashboard no-store| W
    W -->|rewrite /api/* same-origin| A[Express API<br/>api.nayankunwar.com]
    V -.->|sendBeacon text/plain<br/>POST /api/v1/analytics/clicks| W
    V -->|anchor click| X[Original URL]
    A --> P[(Neon PostgreSQL)]
    A -->|HMAC POST /internal/revalidate<br/>server-to-server| W
    A --> M[Brevo email]
    J[Nightly job<br/>rollup, clear hashes, purge, prune] --> P
```

---

## 5. Routing

### 5.1 Web Route Map

| Path | Type | Caching | Tier |
|---|---|---|---|
| `/` | Static/ISR | `ROOT_MODE=profile` → renders `DEFAULT_USERNAME` profile; `landing` → marketing page | MVP / Public launch |
| `/:username` | Dynamic `[username]` ISR | `revalidate=300` + tag `profile:<username>` | MVP |
| `/login`, `/signup`, `/verify-email`, `/reset-password`, `/forgot-password`, `/check-inbox` | Static | default | MVP (signup/verify/reset UI: Public launch) |
| `/restore-account` | Static | default; reads `?token=` client-side | MVP |
| `/dashboard/**`, `/settings/**` | Dynamic | `no-store`, `dynamic = 'force-dynamic'`; `proxy.ts` redirects when `lh.sid` is absent | MVP |
| `/preview` | Route handler | `no-store`; sets a demo `lh.sid` cookie and redirects to `/dashboard` | Demo only (disabled unless `ALLOW_DEMO_PREVIEW=true`) |
| `/terms`, `/privacy` | Static | default | Public launch |
| `not-found` | Static | default | MVP |
| `/api/*` | **Rewrite** → Express | per route (public profile cacheable; auth/dashboard `no-store`) | MVP |
| `/internal/revalidate` | Next.js route handler (POST) | none | MVP |
| `/robots.txt`, `/sitemap.xml` | Generated metadata routes (`robots.ts`, `sitemap.ts`) | `revalidate=3600` | Public launch |

- **Cache headers are per route.** Public profile API responses are cacheable (`Cache-Control: public, s-maxage=300, stale-while-revalidate=60`) so Next.js tagged fetches work; authenticated/dashboard API responses are `no-store`. A global `no-store` on the API would make ISR tag revalidation ineffective.
- **`ROOT_MODE` on `/`:** a static root page reads `ROOT_MODE` at build time, so changing it requires a redeploy. If runtime switching is desired, make the root dynamic or add a small runtime config route; do not assume an env change alone updates a static page.
- **SEO:** `generateMetadata` supplies title, description, canonical URL and Open Graph data for published profiles; unpublished/unknown profiles return 404 (noindex). `sitemap.xml` lists published profiles only; `robots.txt` disallows `/dashboard`, `/settings` and `/api` and points to the sitemap.
- **`/preview` is not a production route.** It exists for the UI-first mock milestone and must return 404 unless `ALLOW_DEMO_PREVIEW=true`; production deployments leave it false and use the real login flow. It must never be linked from marketing pages in production.
- **Token pages:** `/restore-account` (and the verification/reset pages) set `Referrer-Policy: no-referrer` and `Cache-Control: no-store` because the token is in the URL.

### 5.2 Reserved Usernames

Maintained in `packages/shared/src/constants.ts` and used by both the username validator and route-conflict tests:

```
api, admin, dashboard, login, logout, signup, register, verify-email,
reset-password, forgot-password, check-inbox, restore-account,
settings, account, internal, health,
_next, static, public, assets, favicon.ico, robots.txt, sitemap.xml,
terms, privacy, about, help, support, docs, blog, pricing, www, mail,
root, owner, null, undefined, me, new, edit,
profile, links, categories, analytics, export, auth, oauth, callback,
webhooks, cron, jobs, status, contact, legal, security, changelog,
roadmap, features, faq, home, index, manifest, icon, apple-icon,
opengraph-image, twitter-image, well-known, cdn, img, images, media,
uploads, files, dev, staging, preview, test, metrics, debug
```

Username rule: `^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$` (3–30 chars, lowercase, no leading/trailing hyphen). Input is lowercased before validation; `profiles.username` is `citext` with a unique index and a raw SQL CHECK for the regex. Anything containing a dot is rejected, so file-like paths can never match a username.

Reserve **planned** top-level routes and Next.js metadata route names now, not only routes that currently exist: a username claimed today must not become shadowed when a Later feature adds `/profile`, `/analytics`, etc. Re-review this list whenever a top-level route or generated metadata route is added.

### 5.3 Precedence & Middleware Order

- Next.js resolves **static segments before dynamic ones**, so `app/dashboard`, `app/login`, etc. always beat `app/[username]`. The reserved list guarantees no user can claim a name that would be shadowed.
- `next.config.ts` rewrites **only** `/api/:path*` → `${API_BASE_URL}/api/:path*`. `/internal/*` is **not** rewritten and is served by Next.js.
- Next.js 16 uses `proxy.ts` (Next.js 15 uses `middleware.ts`); the matcher covers `/dashboard/:path*` and `/settings/:path*`, excludes `_next`, `api`, `internal` and static files, and redirects unauthenticated requests to `/login?next=…`. The proxy only checks that the `lh.sid` cookie is present; the API remains the identity authority. During the UI-first milestone the cookie is a client-readable demo value; the API milestone replaces it with an httpOnly server session.
- `[username]/page.tsx` calls `notFound()` for reserved, unknown or unpublished profiles. In the UI-first milestone the public page renders from the mock store and shows the same unavailable state for unknown and unpublished profiles.

**Express middleware order:**

1. `trust proxy`
2. request ID
3. pino HTTP logger
4. `helmet`
5. CORS (allow `APP_URL` only; browsers normally never hit the API cross-origin)
6. route-scoped click parser (`express.text()` on `/api/v1/analytics/clicks` only)
7. `express.json({ limit: '100kb' })`
8. session
9. `loadUser` + **account-status check**
10. CSRF / Origin check (non-GET)
11. rate limiters
12. routers
13. 404 → error handler (envelope)

**Route-specific exceptions:** `/api/v1/analytics/clicks` installs its own Origin check, limiter and parser-error handler so every outcome is `204`; the global CSRF/Origin middleware must skip this path. The public profile limiter exempts requests carrying a valid `X-Internal-Token` matching `INTERNAL_FETCH_TOKEN`. Public profile, availability and click routes are mounted **before** the session middleware (they never need `req.session`) but after the shared request-ID, logger, helmet, CORS and rate-limit middleware, so cacheable/beacon responses cannot carry `Set-Cookie` and clicks do not write sessions.

---

## 6. Monorepo Structure

```
link-hub/
├── apps/
│   ├── web/
│   │   ├── app/
│   │   │   ├── page.tsx                 # root (ROOT_MODE)
│   │   │   ├── [username]/page.tsx      # public profile (ISR)
│   │   │   ├── dashboard/…              # no-store
│   │   │   ├── settings/…               # no-store
│   │   │   ├── login/ signup/ verify-email/ reset-password/ forgot-password/ check-inbox/
│   │   │   ├── restore-account/         # emailed deletion-restore link
│   │   │   ├── preview/route.ts         # demo-only cookie + redirect
│   │   │   ├── terms/ privacy/ not-found.tsx
│   │   │   ├── robots.ts
│   │   │   ├── sitemap.ts
│   │   │   └── internal/revalidate/route.ts
│   │   ├── proxy.ts                     # Next.js 16 (middleware.ts on 15)
│   │   └── next.config.ts               # /api/* rewrite
│   └── api/src/
│       ├── modules/{auth,account,profile,links,categories,analytics,export}/
│       ├── lib/{db,tenant,entitlements,mailer,revalidate,tokens,errors,logger}.ts
│       ├── middleware/{session,loadUser,csrf,rateLimit,requestId,requireAuth}.ts
│       ├── jobs/analytics-nightly.ts   # totals → breakdowns → clear hashes → purge → prune (§11.3)
│       └── app.ts
├── packages/shared/                     # Zod schemas, DTOs, reserved list, constants
├── prisma/{schema.prisma,migrations/,seed.ts}
├── .github/workflows/ci.yml             # lint, typecheck, unit, integration, build
├── docker-compose.yml                   # local Postgres for integration tests
└── pnpm-workspace.yaml
```

Module files: `*.routes.ts`, `*.controller.ts`, `*.service.ts`, `*.repository.ts` (owned resources only — it exists to enforce tenant scope), `*.schema.ts`, `*.test.ts`. No base repositories, DI containers, or interface-per-class patterns.

---

## 7. Multi-Tenancy & Authorization

### 7.1 Ownership

Owned resources (all carry `user_id`): `profiles`, `categories`, `links`, `click_events`, `click_daily_stats`, `click_daily_breakdowns`, `verification_tokens`, `accounts`. Sessions reference the user via `sess.userId` and store display metadata (`userAgent`, `createdAt`, `lastSeenAt`) in the JSON payload; they never store IP addresses.

### 7.2 Tenant-Scoped Repositories

```ts
// lib/tenant.ts
export const scoped = (userId: string) => ({
  links: {
    list: (where: Prisma.LinkWhereInput = {}) =>
      prisma.link.findMany({ where: { ...where, userId, deletedAt: null }, orderBy: { sortOrder: 'asc' } }),
    get: (id: string) => prisma.link.findFirst({ where: { id, userId, deletedAt: null } }),
    update: (id: string, data: Prisma.LinkUpdateManyMutationInput) =>
      prisma.link.updateMany({ where: { id, userId, deletedAt: null }, data }),
  },
  // categories, profile, analytics, export …
});
```

- `userId` comes only from `req.user.id` (resolved from the session).
- Non-owned and non-existent IDs both return `404 NOT_FOUND`.
- Reorder validates that **all** submitted IDs belong to the user before writing; otherwise `404`, nothing written. The payload is a full ordered set for the affected scope (all links in the category/ungrouped list, or all categories): duplicates, missing IDs, and IDs outside the scope are rejected. The whole reorder runs in one transaction, and it locks the affected rows (`SELECT ... FOR UPDATE`) or takes a per-user advisory lock before assigning `sort_order`; a transaction alone does not prevent two concurrent reorders from interleaving.
- **Referenced IDs are ownership-checked too:** on link create/update the service resolves `categoryId` through `scoped(userId).categories.get()`, which filters `deletedAt: null`; not found/not owned/soft-deleted → `404 NOT_FOUND` (never 403), nothing written. The composite FK (§8.3) is the DB backstop. The same rule applies to reorder payloads (link and category IDs) and to the future `page_id` (§21.1).
- Analytics and export queries filter by `user_id` directly, never by a client-supplied link list alone.

### 7.3 Account Status

| Status | Login | Authenticated requests | Public profile |
|---|---|---|---|
| `pending_verification` | Allowed → only `/auth/me`, `/auth/resend-verification`, `/auth/logout` | `403 EMAIL_NOT_VERIFIED` for everything else | Hidden |
| `active` | Allowed | Allowed | Visible if published |
| `active` with `deletion_scheduled_for` | Allowed; a successful login clears the schedule (restore) | Allowed so the owner can export or restore | Hidden (profile unpublished) |
| `suspended` | `403 ACCOUNT_SUSPENDED` | Session destroyed, `403 ACCOUNT_SUSPENDED` | Hidden (404) |
| `deleted` | `401 INVALID_CREDENTIALS` | Session destroyed, `401` | Hidden (404) |

`loadUser` reads the user row **on every authenticated request** (one indexed PK lookup), so status changes take effect immediately. Status changes also delete that user's sessions (`DELETE FROM sessions WHERE sess->>'userId' = $1`) and revalidate their profile tag. The expression index `sessions((sess->>'userId'))` is **required**, not optional: this query runs on every suspension, deletion and password reset. The user purge also deletes any remaining sessions, because `sessions` has no FK to `users`.

**Deletion grace:** scheduling deletion sets `users.deletion_scheduled_for = now() + interval '30 days'`, sets `profiles.is_published = false`, and revokes every session except the current one. The account remains `active` during the grace period so the owner can sign in, export and restore; the public page is hidden because the profile is unpublished. `DELETE /account` is idempotent. The nightly prune hard-deletes users whose `deletion_scheduled_for` has passed (cascading profiles, links, categories, analytics and tokens, plus the session cleanup above); it marks `status=deleted` immediately before the hard delete for audit clarity. The `/restore-account?token=…` route and a successful login both clear `deletion_scheduled_for`; neither republishes the profile.

### 7.4 Entitlements

```ts
// lib/entitlements.ts
export const PLANS = {
  free: {
    maxLinks: 50,
    maxCategories: 20,
    rawEventRetentionDays: 90,
    analyticsHistoryDays: 365,
    exportEnabled: true,
  },
} as const;
export type PlanId = keyof typeof PLANS;
export const entitlementsFor = (plan: PlanId) => PLANS[plan];
export async function assertWithinLimit(userId: string, plan: PlanId, kind: 'links' | 'categories') { /* → 403 LIMIT_REACHED */ }
```

All plan checks (limits, raw/history retention used by jobs and analytics ranges, export) call this module only. New plans = new keys; billing is **Later**.

`assertWithinLimit` counts only `deleted_at IS NULL` rows and is atomic: run the count and insert in one transaction after `SELECT id FROM users WHERE id = $1 FOR UPDATE` (or a per-user advisory lock). A plain count-then-insert can exceed the limit under concurrent requests. `rawEventRetentionDays` bounds `click_events`; `analyticsHistoryDays` bounds dashboard ranges. `click_daily_stats` and `click_daily_breakdowns` themselves are kept for the life of the link.

---

## 8. Database Design

Conventions: UUID PKs, `TIMESTAMPTZ`, snake_case, `created_at`/`updated_at`, soft delete (`deleted_at`) on `users`, `links`, `categories`.

### 8.1 ER Diagram

```mermaid
erDiagram
    users ||--o| profiles : has
    users ||--o{ accounts : "auth providers (Later)"
    users ||--o{ sessions : "via sess.userId"
    users ||--o{ verification_tokens : has
    users ||--o{ categories : owns
    users ||--o{ links : owns
    users ||--o{ custom_domains : "owns (Later, not migrated)"
    categories ||--o{ links : groups
    links ||--o{ click_events : receives
    links ||--o{ click_daily_stats : "rolled up"
    links ||--o{ click_daily_breakdowns : "rolled up"

    users {
        uuid id PK
        citext email UK
        citext pending_email
        text password_hash
        text role "owner|admin|user"
        text status "pending_verification|active|suspended|deleted"
        text plan "free"
        timestamptz email_verified_at
        timestamptz deletion_scheduled_for
        timestamptz created_at
        timestamptz updated_at
        timestamptz deleted_at
    }
    accounts {
        uuid id PK
        uuid user_id FK
        text provider
        text provider_account_id
    }
    sessions {
        text sid PK
        json sess "contains userId"
        timestamp expire "timestamp(6)"
    }
    verification_tokens {
        uuid id PK
        uuid user_id FK
        text type "email_verification|password_reset|email_change|account_restore"
        text token_hash UK
        timestamptz expires_at
        timestamptz used_at
        timestamptz created_at
    }
    profiles {
        uuid id PK
        uuid user_id FK,UK
        citext username UK
        text display_name
        text headline
        text bio
        text avatar_url
        json socials
        json theme "appearance settings"
        boolean is_published
    }
    categories {
        uuid id PK
        uuid user_id FK
        text name
        text description
        text color
        text icon
        boolean is_visible
        int sort_order
        timestamptz deleted_at
    }
    links {
        uuid id PK
        uuid user_id FK
        uuid category_id FK
        text title
        text url
        text description
        text icon
        boolean is_active
        int sort_order
        timestamptz deleted_at
    }
    click_events {
        uuid id PK
        uuid link_id FK
        uuid user_id FK
        timestamptz clicked_at
        text referrer_host
        text device_type
        varchar country_code
        text visitor_hash
    }
    click_daily_stats {
        uuid link_id PK,FK
        date day PK
        uuid user_id FK
        int count
    }
    click_daily_breakdowns {
        uuid link_id PK,FK
        date day PK
        text dimension PK
        text value PK
        uuid user_id FK
        int count
    }
    custom_domains {
        uuid id PK
        uuid user_id FK
        text host UK
        timestamptz verified_at
    }
```

### 8.2 Indexes

`links(user_id, sort_order)`, `links(user_id, category_id)`, `links(user_id, deleted_at)`, `categories(user_id, sort_order)`, `categories(user_id, deleted_at)`, `click_events(link_id, clicked_at)`, `click_events(user_id, clicked_at)`, `click_events(clicked_at)` (nightly rollup and hash clearing), partial `click_events(clicked_at) WHERE visitor_hash IS NOT NULL` (hash clearing), `click_daily_stats(user_id, day)`, `click_daily_breakdowns(user_id, day)`, unique `profiles(username)` (citext), unique `profiles(user_id)`, unique `users(email)`, unique `accounts(provider, provider_account_id)`, unique `verification_tokens(token_hash)`, `verification_tokens(user_id, type)`, `verification_tokens(expires_at)` (prune), `sessions(expire)`, partial `users(deletion_scheduled_for) WHERE deletion_scheduled_for IS NOT NULL` (purge scan), and the required expression index `sessions((sess->>'userId'))` via raw SQL migration for "log out everywhere". Add partial indexes for soft-delete scans (`links`, `categories`, `users` `WHERE deleted_at IS NULL`) in the same raw SQL migration; Prisma does not express partial indexes. A unique partial index on `users(pending_email) WHERE pending_email IS NOT NULL` prevents two accounts claiming the same pending address; the service still returns a generic conflict to avoid enumeration.

### 8.3 Prisma Schema (core)

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")   // Neon pooled (-pooler host)
  directUrl  = env("DIRECT_URL")     // Neon direct, used by migrate
  extensions = [citext]
}

enum Role {
  owner
  admin
  user
}
enum UserStatus {
  pending_verification
  active
  suspended
  deleted
}
enum Plan {
  free
}
enum TokenType {
  email_verification
  password_reset
  email_change
  account_restore
}

model User {
  id              String     @id @default(uuid()) @db.Uuid
  email           String     @unique @db.Citext
  pendingEmail    String?    @map("pending_email") @db.Citext
  passwordHash    String?    @map("password_hash")
  role            Role       @default(user)
  status          UserStatus @default(pending_verification)
  plan            Plan       @default(free)
  emailVerifiedAt DateTime?  @map("email_verified_at") @db.Timestamptz
  deletionScheduledFor DateTime? @map("deletion_scheduled_for") @db.Timestamptz
  createdAt       DateTime   @default(now()) @map("created_at") @db.Timestamptz
  updatedAt       DateTime   @updatedAt @map("updated_at") @db.Timestamptz
  deletedAt       DateTime?  @map("deleted_at") @db.Timestamptz
  profile         Profile?
  accounts        Account[]
  tokens          VerificationToken[]
  categories      Category[]
  links           Link[]
  clickEvents     ClickEvent[]
  clickDailyStats ClickDailyStat[]
  clickDailyBreakdowns ClickDailyBreakdown[]
  @@map("users")
}

model Account {            // Later: OAuth. Table exists, unused in MVP.
  id                String @id @default(uuid()) @db.Uuid
  userId            String @map("user_id") @db.Uuid
  provider          String
  providerAccountId String @map("provider_account_id")
  user              User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([provider, providerAccountId])
  @@map("accounts")
}

model Session {            // mirrors connect-pg-simple's table exactly; userId lives inside sess JSON
  sid    String   @id @db.VarChar(255)
  sess   Json     @db.Json
  expire DateTime @db.Timestamp(6)
  @@index([expire])
  @@map("sessions")
}

model VerificationToken {
  id        String    @id @default(uuid()) @db.Uuid
  userId    String    @map("user_id") @db.Uuid
  type      TokenType
  tokenHash String    @unique @map("token_hash")
  expiresAt DateTime  @map("expires_at") @db.Timestamptz
  usedAt    DateTime? @map("used_at") @db.Timestamptz
  createdAt DateTime  @default(now()) @map("created_at") @db.Timestamptz
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, type])
  @@index([expiresAt])
  @@map("verification_tokens")
}

model Profile {
  id          String   @id @default(uuid()) @db.Uuid
  userId      String   @unique @map("user_id") @db.Uuid
  username    String   @unique @db.Citext
  displayName String   @map("display_name")
  headline    String?
  bio         String?
  avatarUrl   String?  @map("avatar_url")
  socials     Json     @default("{}")
  theme       Json     @default("{}")   // appearance: theme, color, background, card, button, visibility
  isPublished Boolean  @default(false) @map("is_published")
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime @updatedAt @map("updated_at") @db.Timestamptz
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@map("profiles")
}

model Category {
  id          String    @id @default(uuid()) @db.Uuid
  userId      String    @map("user_id") @db.Uuid
  name        String
  description String?
  color       String    @default("#7c3aed")
  icon        String    @default("folder")
  isVisible   Boolean   @default(true) @map("is_visible")
  sortOrder   Int       @default(0) @map("sort_order")
  createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime  @updatedAt @map("updated_at") @db.Timestamptz
  deletedAt   DateTime? @map("deleted_at") @db.Timestamptz
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  links       Link[]
  @@unique([id, userId])          // target of composite FK from links
  @@index([userId, sortOrder])
  @@index([userId, deletedAt])
  @@map("categories")
}

model Link {
  id          String           @id @default(uuid()) @db.Uuid
  userId      String           @map("user_id") @db.Uuid
  categoryId  String?          @map("category_id") @db.Uuid
  title       String
  url         String
  description String?
  icon        String           @default("auto")
  isActive    Boolean          @default(true) @map("is_active")
  sortOrder   Int              @default(0) @map("sort_order")
  createdAt   DateTime         @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime         @updatedAt @map("updated_at") @db.Timestamptz
  deletedAt   DateTime?        @map("deleted_at") @db.Timestamptz
  user        User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  // Composite FK: a link can only reference a category of the SAME user.
  // NoAction (not SetNull): SetNull on a composite FK would null user_id too.
  category    Category?        @relation(fields: [categoryId, userId], references: [id, userId], onDelete: NoAction, onUpdate: NoAction)
  clicks      ClickEvent[]
  dailyStats  ClickDailyStat[]
  dailyBreakdowns ClickDailyBreakdown[]
  @@unique([id, userId])          // target of composite FKs from click_events/click_daily_stats
  @@index([userId, sortOrder])
  @@index([userId, categoryId])
  @@index([userId, deletedAt])
  @@map("links")
}

model ClickEvent {
  id           String   @id @default(uuid()) @db.Uuid
  linkId       String   @map("link_id") @db.Uuid
  userId       String   @map("user_id") @db.Uuid
  clickedAt    DateTime @default(now()) @map("clicked_at") @db.Timestamptz
  referrerHost String?  @map("referrer_host")
  deviceType   String?  @map("device_type")
  countryCode  String?  @map("country_code") @db.VarChar(2)
  visitorHash  String?  @map("visitor_hash")
  // Composite FK keeps link_id and user_id in the same tenant.
  link         Link     @relation(fields: [linkId, userId], references: [id, userId], onDelete: Cascade)
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([linkId, clickedAt])
  @@index([userId, clickedAt])
  @@index([clickedAt])
  @@map("click_events")
}

model JobState {           // single-row-per-job watermark for the nightly analytics job
  name      String   @id
  watermark DateTime @db.Date
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz
  @@map("job_state")
}

model ClickDailyStat {
  linkId String   @map("link_id") @db.Uuid
  userId String   @map("user_id") @db.Uuid
  day    DateTime @db.Date
  count  Int      @default(0)
  // Composite FK keeps link_id and user_id in the same tenant.
  link   Link     @relation(fields: [linkId, userId], references: [id, userId], onDelete: Cascade)
  user   User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@id([linkId, day])
  @@index([userId, day])
  @@map("click_daily_stats")
}

model ClickDailyBreakdown {
  linkId    String   @map("link_id") @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  day       DateTime @db.Date
  dimension String   // country | device | referrer
  value     String   // ISO country code, device class or referrer host
  count     Int      @default(0)
  // Composite FK keeps link_id and user_id in the same tenant.
  link      Link     @relation(fields: [linkId, userId], references: [id, userId], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@id([linkId, day, dimension, value])
  @@index([userId, day, dimension])
  @@map("click_daily_breakdowns")
}
```

**Category FK choice:** Prisma can express the optional composite relation (nullable `categoryId` + shared non-null `userId`), but `onDelete: SetNull` would emit `SET NULL` for both columns and fail on `user_id NOT NULL`. PG15 `ON DELETE SET NULL (category_id)` would work but requires hand-edited SQL that Prisma would treat as drift. Chosen: `NoAction`, and since categories are soft-deleted, the category service sets `category_id = NULL` on that user's links and soft-deletes the category in one transaction; the purge job does the same before hard-deleting. `scoped(userId).categories.get()` must filter `deletedAt: null`, so the service does not assign a link to a soft-deleted category.

**Analytics FKs:** `click_events`, `click_daily_stats` and `click_daily_breakdowns` carry both `link_id` and `user_id`, and each has a composite FK `(link_id, user_id) → links(id, user_id)` in addition to the user FK. This makes a cross-tenant analytics row impossible even if a service bug or manual insert supplies mismatched IDs; `links` therefore has `@@unique([id, user_id])`. Both values are derived server-side on ingest.

**Profile and presentation fields:** `headline` is capped at 80 characters; `socials` is validated by the shared `socialsSchema` (HTTPS URLs plus a `mailto:` email link, each ≤ 2048 chars). `theme` is the validated appearance object (theme id, six-digit color, background/card/button enums, four visibility booleans); it never contains arbitrary CSS. Category `color` is a six-digit hex, category/link `icon` values come from the shared fixed icon lists, and category `description` is capped at 80 characters. Category visibility is presentation state: hidden categories and their links are excluded from the public DTO and public page, but remain in the dashboard.

**Username and session constraints:** `profiles.username` is `citext` for case-insensitive uniqueness; a raw SQL CHECK enforces the lowercase regex. The `sessions` table is created by the Prisma migration with the exact `connect-pg-simple` types (`sid varchar(255)`, `sess json`, `expire timestamp(6)`), and the store is configured with `createTableIfMissing: false`. The expression index `sessions((sess->>'userId'))` is added in a raw SQL migration. Session JSON stores `userId`, `userAgent`, `createdAt` and `lastSeenAt` so Settings can list and revoke devices; it never stores an IP. If the library already created the table in an existing environment, baseline it before switching.

**Retention:** `rawEventRetentionDays` (free: 90) bounds `click_events`; `analyticsHistoryDays` (free: 365) bounds dashboard ranges. `click_daily_stats` and `click_daily_breakdowns` are kept for the life of the link. Unique-visitor counts are not stored in MVP (see §21).

`citext` is declared via `extensions = [citext]` and created by the first migration. Neon: `DATABASE_URL` = pooled connection string (`-pooler` host, `pgbouncer=true`) for runtime; `DIRECT_URL` = non-pooled for `prisma migrate`. `custom_domains` is documented only (**Later**). Soft-deleted links are hard-purged after 30 days by the prune job; cascades remove their analytics.

---

## 9. Authentication & Account Lifecycle

| Concern | Design | Tier |
|---|---|---|
| Password hashing | argon2id (m=19 MiB, t=2, p=1); password length 12–128 chars, capped before hashing to avoid DoS | MVP |
| Login timing | Unknown email still performs a dummy argon2 verify so response timing does not reveal account existence | MVP |
| Sessions | `express-session` + `connect-pg-simple`; cookie `lh.sid` (or `__Host-lh.sid` in production) httpOnly, Secure (prod), SameSite=Lax, no `Domain` attribute (host-only on `link.nayankunwar.com` via the rewrite), 7-day rolling; store table `sessions`, `createTableIfMissing: false`, table created by the Prisma migration matching `sid varchar(255)`, `sess json`, `expire timestamp(6)`, with the `sess->>'userId'` expression index added by raw SQL; session JSON also stores `userAgent`, `createdAt` and `lastSeenAt` (never IP); regenerate on login; destroy on logout | MVP |
| Owner bootstrap | `pnpm db:seed` → `role=owner`, `status=active`, `email_verified_at=now()`, profile `DEFAULT_USERNAME` | MVP |
| Status check | Login + `loadUser` on every authenticated request (§7.3) | MVP |
| Registration | `POST /auth/register` — `403 SIGNUP_DISABLED` unless `ALLOW_SIGNUP=true`. Creates user (`pending_verification`), profile (unpublished, chosen username), verification token, sends email. Generic response to avoid email enumeration | Built MVP, enabled Public launch |
| Email verification | 32-byte random token, emailed as link `APP_URL/verify-email?token=…`; only `sha256(token)` stored; single-use (`used_at`) consumed atomically (`UPDATE ... WHERE used_at IS NULL RETURNING`); 24 h expiry; success → `status=active` | Public launch |
| Resend verification | Invalidates prior unused tokens; rate-limited (3/h per user) | Public launch |
| Password reset | Same token scheme, type `password_reset`, 1 h expiry; always `200` on request; token consumed atomically; on reset: update hash, delete **all** user sessions | Public launch |
| Email change | `PATCH /account/email` requires the current password, validates the new address, stores `users.pending_email`, and issues a 32-byte token of type `email_change` to the **new** address (24 h expiry). `POST /auth/verify-email-change` consumes it atomically and swaps `email`/`pending_email`, sets `email_verified_at`, and invalidates the old address. The current email stays active until verification; `DELETE /account/email` cancels a pending change. Never reveals whether the target address is already registered. | MVP |
| Password change | `PATCH /account/password` requires the current password and the 12–128 policy; updates the hash and deletes **all other** sessions, keeping the current one. | MVP |
| Session management | `GET /account/sessions` lists the current user's sessions from `sess` metadata; `DELETE /account/sessions/:sid` revokes one (non-current) session; `DELETE /account/sessions` revokes all others. Non-owned/non-existent SIDs → 404. | MVP |
| Account deletion & restore | `DELETE /account` requires the current password and the exact username, sets `deletion_scheduled_for = now() + 30 days`, unpublishes the profile, revokes all other sessions and emails a restore link (`account_restore` token, 30-day window). `POST /account/restore` consumes the token and clears the schedule; a successful login also clears it. Restoring does not republish. The nightly prune hard-deletes expired accounts. | MVP |
| Email transport | Brevo in prod (`EMAIL_PROVIDER=brevo`), console logger in dev/test; outbound timeout + retry/log; verification/reset/restore pages set `Referrer-Policy: no-referrer` and `Cache-Control: no-store` | Public launch |
| OAuth | `accounts` table reserved | Later |

---

## 10. API Design

Base: `/api/v1`. JSON envelopes. **All non-GET requests require an Origin check and a CSRF token**, including login/register/forgot/reset (login CSRF and email bombing are in scope); the anonymous click endpoint is the exception — Origin-only and always `204`. Versioning: URL-based; breaking changes → `/api/v2` with `Deprecation`/`Sunset` headers; additive changes within a version.

### 10.1 Endpoints

**Auth**

| Method | Path | Auth | Tier |
|---|---|---|---|
| GET | `/auth/csrf` | – | MVP |
| POST | `/auth/login` | – | MVP |
| POST | `/auth/logout` | session | MVP |
| GET | `/auth/me` | session | MVP |
| POST | `/auth/register` | – (flag) | MVP (flag-off) / Public launch |
| POST | `/auth/verify-email` `{ token }` | – | Public launch |
| POST | `/auth/verify-email-change` `{ token }` | – | MVP |
| POST | `/auth/resend-verification` | session (pending) | Public launch |
| POST | `/auth/forgot-password` `{ email }` | – | Public launch |
| POST | `/auth/reset-password` `{ token, password }` | – | Public launch |

`GET /auth/csrf` sets (or rotates) the readable `lh.csrf` cookie and returns `{ csrfToken }` with `Cache-Control: no-store`; clients echo it in `X-CSRF-Token`. The cookie is `SameSite=Lax`, `Secure` in production, `Path=/`, and is not httpOnly because the client must read it.

**Account (own)**

| Method | Path | Tier |
|---|---|---|
| GET | `/account` → email, `pendingEmail`, `emailVerified`, plan, createdAt, `deletionScheduledFor` | MVP |
| PATCH | `/account/email` `{ email, currentPassword }` | MVP |
| DELETE | `/account/email` (cancel pending change) | MVP |
| PATCH | `/account/password` `{ currentPassword, newPassword }` | MVP |
| GET | `/account/sessions` | MVP |
| DELETE | `/account/sessions/:sid` | MVP |
| DELETE | `/account/sessions` (all others) | MVP |
| DELETE | `/account` `{ password, confirmUsername }` | MVP |
| POST | `/account/restore` `{ token }` | MVP |

All account routes are authenticated except `POST /account/restore` (token is the credential). `DELETE /account` is idempotent: a second call while already scheduled returns the same `deletionScheduledFor`. `PATCH /account/email` returns a generic success response whether or not the target address is already in use, and sends the verification link only to the new address.

**Public**

| Method | Path | Tier |
|---|---|---|
| GET | `/public/profiles/:username` | MVP |
| GET | `/usernames/:username/availability` → `{ available, reason? }` (`reserved`/`taken`/`invalid`) | MVP |

`/public/profiles/:username` returns an **explicit DTO** (profile display fields incl. `headline`, `avatarUrl` and validated `socials`, appearance, published active links with their icon, visible categories with name/description/color/icon/order) and never `email`, `pending_email`, `status`, `plan`, `deletion_scheduled_for`, `user_id`, session data or internal IDs. Hidden categories and their links are omitted. It is cacheable (`Cache-Control: public, s-maxage=300, stale-while-revalidate=60`) so Next.js tagged fetches work. It is rate-limited 120/min/IP for browsers, but requests carrying a valid `X-Internal-Token` equal to `INTERNAL_FETCH_TOKEN` are exempt so Vercel ISR/build traffic does not consume the bucket. The public profile endpoint must not set cookies (`saveUninitialized: false`), or a cached `Set-Cookie` could leak a session. The availability endpoint is rate-limited 30/min/IP and returns only `available`/`reason`.

**Profile (own)**

| Method | Path | Tier |
|---|---|---|
| GET | `/profile` | MVP |
| PATCH | `/profile` (display name, headline, bio, avatar URL, socials, username change) | MVP |
| POST | `/profile/publish` · `/profile/unpublish` | MVP |

**Links (own)**: `GET /links?search=&categoryId=&status=`, `POST /links`, `GET/PATCH/DELETE /links/:id`, `PATCH /links/:id/status`, `PUT /links/reorder` — MVP. Payloads include `title`, `url`, `description`, `categoryId`, `icon`, `isActive`; reorder is a full ordered set.

**Categories (own)**: `GET/POST /categories`, `PATCH/DELETE /categories/:id`, `PUT /categories/reorder` — MVP. Payloads include `name`, `description`, `color`, `icon`, `isVisible`; delete detaches links in the same transaction.

**Analytics**

| Method | Path | Auth | Tier |
|---|---|---|---|
| POST | `/analytics/clicks` | – | MVP |
| GET | `/analytics/overview?range=` | session | MVP |
| GET | `/analytics/links/:id` | session | MVP |
| GET | `/analytics/timeseries?range=&linkId=` | session | MVP |
| GET | `/analytics/breakdowns?range=&linkId=&dimension=country\|device\|referrer` | session | MVP |

`range` is a closed enum (`7d`, `30d`, `90d`, `365d`) capped by `analyticsHistoryDays`; `linkId` is resolved through the scoped repository, so another user's link is `404`. Breakdowns combine `click_daily_breakdowns` for rolled-up days with raw `click_events` for days after the watermark. Days are UTC and the dashboard labels that explicitly.

**Export (own)**: `GET /export?format=json|csv` — MVP. JSON is `schemaVersion: 2`. CSV is a zip of `profile.csv`, `links.csv`, `categories.csv`, `daily_stats.csv` and `daily_breakdowns.csv`; rate-limited 5/h; cells escaped per §14.

**Ops**: `GET /api/v1/health` — MVP (readiness, includes DB) · `GET /api/v1/health/live` — liveness only, no DB check · `GET /debug/ip` — owner-only, disabled unless `DEBUG_IP_ENDPOINT=true` (deployment verification only)

**Internal (Next.js, not Express)**: `POST /internal/revalidate` — MVP (see §11.2)

### 10.2 Responses

```text
{ "success": true, "data": {} }
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "…", "details": [] } }
```

| Status | Codes |
|---|---|
| 200/201/204 | success |
| 400 | `VALIDATION_ERROR`, `TOKEN_INVALID`, `TOKEN_EXPIRED` |
| 401 | `UNAUTHENTICATED`, `INVALID_CREDENTIALS` |
| 403 | `FORBIDDEN`, `CSRF_INVALID`, `SIGNUP_DISABLED`, `EMAIL_NOT_VERIFIED`, `ACCOUNT_SUSPENDED`, `LIMIT_REACHED` |
| 404 | `NOT_FOUND` (incl. non-owned) |
| 409 | `USERNAME_TAKEN`, `USERNAME_RESERVED`, `CONFLICT` |
| 429 | `RATE_LIMITED` |
| 500 | `INTERNAL_ERROR` |

---

## 11. Public Pages, Click Tracking & Revalidation

### 11.1 Click Tracking (best-effort)

**Problem (v2.0):** `sendBeacon(url, new Blob([json], { type: 'application/json' }))` sends a non-CORS-safelisted content type; cross-origin it is preflighted, which beacons cannot do, so it is dropped.

**Resolution:**

1. Beacon targets the **same-origin** `/api/v1/analytics/clicks` (via the Next.js rewrite) — no CORS involved.
2. Body sent as a **plain string** → `text/plain;charset=UTF-8` (safelisted). Include the page's external referrer, not the request header (the request `Referer` is the profile page itself):
   ```ts
   const referrer = (() => {
     try {
       const host = new URL(document.referrer).hostname.toLowerCase();
       return host && host !== location.hostname ? host.slice(0, 255) : undefined;
     } catch { return undefined; }
   })();
   const body = JSON.stringify({ linkId, referrer });
   if (!navigator.sendBeacon?.('/api/v1/analytics/clicks', body)) {
     fetch('/api/v1/analytics/clicks', { method: 'POST', body, keepalive: true,
       headers: { 'Content-Type': 'text/plain' } }).catch(() => {});
   }
   ```
3. API mounts `express.text({ type: 'text/plain', limit: '1kb' })` **only on this route**, then `ClickSchema.parse(JSON.parse(body))` (`{ linkId: uuid, referrer?: string }`) inside try/catch. `referrer` is parsed as a host only, capped at 255 chars, and never trusted for authorization.
4. Origin/Referer must match `APP_URL` (no CSRF token — anonymous endpoint). Use `Origin` first; `Referer` is only a fallback. The request `Referer` is **not** stored as `referrer_host`.
5. Server derives `user_id` from the link; link must be active, not deleted, owner `active`, profile published.
6. **Country:** the web tier adds `X-Web-Proxy-Secret: $WEB_PROXY_SECRET` to the `/api/*` rewrite and forwards the platform's `x-vercel-ip-country` header. The API trusts the country header **only** when the secret matches (constant-time compare) and the value matches `^[A-Z]{2}$`; otherwise `country_code` is null. The browser cannot set the secret, so direct API requests cannot spoof a country. No IP address is stored or logged.
7. Bot UA filtering (`isbot`), missing UA dropped; dedupe 30 s via `visitor_hash = HMAC-SHA256(dailyKey, ip + "|" + ua + "|" + linkId)` where `dailyKey = HMAC-SHA256(ANALYTICS_HASH_SECRET, "YYYY-MM-DD" in UTC)`. The daily key is derived in memory and never stored; the hash cannot be linked across days or links. `visitor_hash` is nulled (UPDATE, never DELETE) by the nightly job once past the dedupe window (kept ≤ 24 h, §11.3). Rotating `ANALYTICS_HASH_SECRET` only affects dedupe across the rotation instant (acceptable); rotate on suspected leak. IP never stored; only `referrer_host` (from `document.referrer`), `device_type` and `country_code` kept.
8. Rate limit 60/min/IP. **Always `204`**, even on invalid input, bad Origin, oversized/malformed body, or rate-limit rejection. The click route has route-specific middleware/handlers: the rate limiter's `handler` returns `204`, and a route-level error handler converts `express.text` parser errors (`entity.too.large`, `entity.parse.failed`) to `204`. Global middleware must not return `403`/`413`/`429` for this path.
9. Anchors are plain `<a href="{url}" target="_blank" rel="noopener noreferrer">`; navigation never waits on tracking.
10. Retention and rollup: see §11.3.

### 11.2 Secure ISR Revalidation

- Public pages: `app/[username]/page.tsx` fetches with `next: { tags: ['profile:<username>'], revalidate: 300 }` (time-based fallback). The public profile API response is cacheable (`Cache-Control: public, s-maxage=300, stale-while-revalidate=60`); a global `no-store` would make tag revalidation ineffective. Auth/dashboard responses remain `no-store`.
- Route handler: **`POST /internal/revalidate`** in Next.js (outside the `/api/*` rewrite — no clash).
- Called **server-to-server** by the API only (`WEB_INTERNAL_URL`); never from browsers.
- Request:
  ```
  X-Revalidate-Timestamp: <unix seconds>
  X-Revalidate-Signature: hex(HMAC_SHA256(REVALIDATE_SECRET, `${timestamp}.${rawBody}`))
  body: { "tags": ["profile:nayan", "profile:old-name"] }
  ```
- Next.js 16 uses `proxy.ts` (Next.js 15: `middleware.ts`). `revalidateTag(tag, 'max')` is a stale-while-revalidate profile, not immediate expiration: the first request after a mutation may still receive stale HTML while regeneration runs. If immediate visibility is required, verify whether `updateTag`/`expireTag` is available in the route handler for the chosen Next version; otherwise keep the 300 s fallback and state the one-request-stale behavior.
- Handler: read the raw body and verify the signature over it **before** JSON parsing; reject if |now − timestamp| > 300 s; constant-time compare (`crypto.timingSafeEqual`); Zod-validate tags (`^profile:[a-z0-9-]{3,30}$`, max 10); call `revalidateTag` for each; return `204`. Invalid → `401` with no detail. The timestamp window bounds replay but does not eliminate it; add a short-lived nonce cache (e.g. 5 min) keyed by the signature if replay matters.
- Triggers: profile update/publish/unpublish, any link/category mutation, reorder, account status change. **On username rename revalidate both old and new tags.**
- Calls are **awaited with a 3 s timeout** (not fire-and-forget) so a Render request freeze cannot drop them; failure is logged and the 300 s fallback heals. If awaiting is too slow, enqueue the revalidation instead.
- Root `/` with `ROOT_MODE=profile` uses tag `profile:${DEFAULT_USERNAME}`.
- Public profile fetches from Next.js send `X-Internal-Token` with the value of `INTERNAL_FETCH_TOKEN`; the API exempts valid (constant-time compare) internal requests from the public 120/min/IP bucket so ISR/build traffic does not exhaust it.

### 11.3 Nightly Analytics Job

One job (`jobs/analytics-nightly.ts`), scheduled ~00:30 UTC. Every step is idempotent; rerunning the whole job is safe.

**Single-run guard:** acquire one lock for the entire run on a **direct**, non-pooled connection (`pg_try_advisory_lock(hashtext('analytics-nightly'))`) and release it in `finally`. PgBouncer transaction pooling does not keep session locks, so do not use the pooled runtime URL for this job. Alternatively, upsert the `job_state` row and `SELECT ... FOR UPDATE` it in a transaction that spans the run. A transaction-scoped lock per step is **not** sufficient: two runs can interleave between steps.

**Watermark:** `job_state(name = 'analytics_rollup', watermark DATE)` records the last fully rolled-up UTC day. It is needed because days with zero clicks produce no `click_daily_stats` rows, so "rolled up" cannot be inferred from rows. On first run (no row), set `watermark` to `COALESCE((SELECT (MIN(clicked_at) AT TIME ZONE 'UTC')::date - 1 FROM click_events), (now() AT TIME ZONE 'UTC')::date - 1)` and backfill complete days in batches; advance `watermark` to `yesterday` only after the backfill completes. `yesterday` means `(now() AT TIME ZONE 'UTC')::date - 1`. If the table is empty, start at yesterday. This prevents historical raw events from being skipped by the dashboard's `days > watermark` rule.

Order:

1. **Roll up totals (a).** For every complete UTC day `d` from `watermark − 2` (re-cover a small window for late inserts) to `yesterday`: recompute from raw events and upsert
   ```sql
   INSERT INTO click_daily_stats (link_id, user_id, day, count)
   SELECT link_id, user_id, $d, count(*) FROM click_events
   WHERE clicked_at >= ($d::timestamp AT TIME ZONE 'UTC')
     AND clicked_at <  (($d + 1)::timestamp AT TIME ZONE 'UTC')
   GROUP BY link_id, user_id
   ON CONFLICT (link_id, day) DO UPDATE SET count = EXCLUDED.count;
   ```
   then advance `watermark` to `yesterday` in the same transaction once every day in the window is upserted (on a first run, only after the batched backfill finishes). Because the recompute window is only `watermark − 2`, the free plan's 90-day retention makes it safe; before adding a shorter retention plan, enforce `rawEventRetentionDays >= lookback + 1` or compute a per-user lower bound so a purged day is never re-rolled. Counting does not use `visitor_hash`, so step 3 cannot affect it.
2. **Roll up breakdowns (b).** In the same transaction/window, recompute the `country`, `device` and `referrer` dimensions:
   ```sql
   INSERT INTO click_daily_breakdowns (link_id, user_id, day, dimension, value, count)
   SELECT link_id, user_id, $d, 'country', country_code, count(*)
   FROM click_events
   WHERE clicked_at >= ($d::timestamp AT TIME ZONE 'UTC')
     AND clicked_at <  (($d + 1)::timestamp AT TIME ZONE 'UTC')
     AND country_code IS NOT NULL
   GROUP BY link_id, user_id, country_code
   ON CONFLICT (link_id, day, dimension, value) DO UPDATE SET count = EXCLUDED.count;
   ```
   Repeat for `device` (`device_type`) and `referrer` (`referrer_host`). Null values are omitted rather than stored as an empty bucket. Delete rows for the day/dimension that no longer exist in the recompute window so a corrected rollup cannot leave stale values. Breakdowns must be written **before** raw events are purged; clearing hashes does not affect them.
3. **Clear hashes (c).** `UPDATE click_events SET visitor_hash = NULL WHERE visitor_hash IS NOT NULL AND clicked_at < now() - interval '24 hours'`. UPDATE only; row counts unchanged. Use the partial index from §8.2.
4. **Purge raw events (d).** Per user, `DELETE FROM click_events WHERE user_id = $u AND clicked_at < LEAST(now() - make_interval(days => $1), ((watermark + 1)::timestamp AT TIME ZONE 'UTC'))` where `$1 = rawEventRetentionDays`. Retention comes from `entitlementsFor(user.plan).rawEventRetentionDays`, and the `watermark + 1` bound guarantees only rolled-up days are deleted. Batch with `ctid IN (SELECT ctid FROM click_events WHERE ... LIMIT 5000)`; repeat until no rows.
5. **Daily stats and breakdowns (e).** `click_daily_stats` and `click_daily_breakdowns` follow their own policy: kept for the life of the link (removed by cascade on link hard-purge). `analyticsHistoryDays` bounds dashboard ranges, not storage. Unique-visitor counts are **not** stored in MVP; adding them later requires a `unique_count` column computed during rollup before step 3 clears hashes.
6. Then the existing prune tasks: expired `verification_tokens`, expired `sessions`, soft-deleted rows past 30 days, and users whose `deletion_scheduled_for` has passed (hard delete, with the same session cleanup). The user purge also deletes sessions by `sess->>'userId'` because there is no FK from `sessions` to `users`.

**Dashboard reads:** totals = `SUM(click_daily_stats.count)` for days `≤ watermark` **+** `COUNT(click_events)` for days `> watermark` (today and any not-yet-rolled-up days). Breakdowns use `click_daily_breakdowns` for days `≤ watermark` **+** raw `click_events` grouped by the dimension for days `> watermark`. Because raw events are only purged for days `≤ watermark`, totals and breakdowns are identical before and after a purge, and before and after hash clearing. Dashboard ranges are capped by `analyticsHistoryDays`; days are UTC and the UI labels that explicitly.

---

## 12. Security

- First-party cookies via same-origin rewrite; session cookie httpOnly, Secure (prod), SameSite=Lax, host-only, `__Host-` prefix where possible. The CSRF cookie is intentionally readable by JS, `SameSite=Lax`, `Secure` (prod), `Path=/`.
- CSRF: signed/bound double-submit token (`lh.csrf` cookie + `X-CSRF-Token` header) **and** Origin check on **all non-GET requests**, including login/register/forgot/reset; the anonymous click route uses Origin only and always returns `204`. Bind the token to the session (or HMAC it) so a sibling-subdomain cookie cannot satisfy the check; login performs session regeneration.
- Account-status enforcement on every authenticated request (§7.3).
- Tenant isolation in repositories; 404 for non-owned; cross-tenant tests mandatory.
- Rate limits (keyed on `req.ip`, which depends on correct `TRUST_PROXY`): login 5/15 min (IP+email); register 5/h/IP; forgot-password & resend 3/h; verify-email 10/h/IP; email-change 5/h/user; password-change 5/h/user; account-delete 3/h/user; account-restore 10/h/IP; availability 30/min/IP; clicks 60/min/IP; authenticated API 300/min/user; public profile 120/min/IP; export 5/h/user. Normalize IPv6 keys to /64 (`ipKeyGenerator`) so rotating addresses cannot bypass limits. The click limiter's handler returns `204`. In-memory now (single instance); Redis **Later**.
- Tokens: random 32 bytes, stored hashed, single-use consumed atomically, expiring; never logged. Password length 12–128 chars before argon2; unknown-email logins perform a dummy hash.
- Revalidation: HMAC + timestamp window; secret server-only; optional nonce cache for replay; `INTERNAL_FETCH_TOKEN` for server-to-server public profile fetches.
- No email enumeration on register/forgot-password; email change returns a generic success and never reveals whether the target address is registered.
- **Country trust:** `x-vercel-ip-country` is accepted only when `X-Web-Proxy-Secret` matches `WEB_PROXY_SECRET` (constant-time compare); the value must be two uppercase letters. Direct API requests without the secret get `country_code = null`. Never derive country from an IP lookup, and never store/log the IP.
- **Account lifecycle:** email-change tokens are 32 random bytes, stored hashed, single-use, 24 h expiry; password change deletes all other sessions; deletion requires password + exact username, is idempotent, and schedules a 30-day purge. Restore tokens are single-use and do not republish the profile. The nightly prune is the only path that hard-deletes a user.
- **Demo route:** `/preview` is disabled unless `ALLOW_DEMO_PREVIEW=true`, is never linked in production, and must not be deployed as an auth bypass. The real session cookie is httpOnly and server-issued.
- Zod on all inputs; URL scheme allowlist `http`/`https`, max 2048 chars; username rules + reserved list. Add field length caps (display name, headline, bio, title, description, category, theme), HTTPS-only avatar URLs with the same private-host denylist, and a private/localhost host denylist for link URLs (IPv4/IPv6 private, loopback, link-local, and cloud metadata addresses). Validate `theme` against a fixed schema (colors/fonts only, no arbitrary CSS).
- `helmet`, CSP on web; CORS restricted to `APP_URL`; `Referrer-Policy: no-referrer` on token pages; SPF/DKIM/DMARC for email.
- Privacy: no raw IPs; visitor hashes are HMACs under an in-memory daily key (from `ANALYTICS_HASH_SECRET`), short-lived; `referrer_host` comes from `document.referrer` host only; `country_code` comes from a trusted proxy header and is never joined to an IP; retention via entitlements.
- Cross-resource ownership: any referenced ID (`categoryId`, reorder IDs, future `page_id`) is resolved through the scoped repository → 404 if not owned; composite FKs enforce it in the DB, including analytics rows.
- Public responses use explicit DTOs; no email, status, plan, `user_id` or internal IDs.
- CSV export escapes formula-leading cells (§14); startup env validation rejects default/short/equal secrets; no secrets or tokens in logs.
- **Proxy trust:** `TRUST_PROXY` is a verified hop count (§17). Too high → clients can spoof `X-Forwarded-For` and evade rate limits/dedupe; too low → every request appears to come from the proxy and all users share one rate-limit bucket. `express-rate-limit` logs validation warnings (e.g. `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR`, `ERR_ERL_PERMISSIVE_TRUST_PROXY`) — treat them as deployment failures.
- Dashboard pages `Cache-Control: no-store`; API authenticated responses `no-store`; public profile API responses cacheable per §11.2.

---

## 13. Abuse & Safety

| Measure | Tier |
|---|---|
| Reserved usernames | MVP |
| URL scheme allowlist + private/localhost/metadata host denylist | MVP |
| Field length caps, theme schema, HTTPS-only avatar URLs with private-host denylist | MVP |
| Availability endpoint rate limit | MVP |
| Suspension via `status=suspended` (manual SQL/script) | MVP |
| Email verification before profile is visible | Public launch |
| Basic abuse report (mailto/form on profile footer → owner inbox) | Public launch |
| ToS and Privacy pages | Public launch |
| SPF/DKIM/DMARC for sending domain | Public launch |
| Safe Browsing URL screening | Later |
| Admin moderation console, reporting queue | Later |
| CAPTCHA (Turnstile) on signup | Later (promote to Public launch if spam appears) |
| Reserved page slugs (for multi-page, §21.1) | Later |

---

## 14. Data Export & Account Deletion

**Export (MVP).** `GET /api/v1/export?format=json|csv` returns the signed-in user's own data, tenant-scoped, and never includes the account email, password hash, sessions, tokens, `user_id` or other users' data. The profile's optional public `socials.email` is exported because it is profile content, not the account address. Exports are rate-limited 5/h/user and filenames are sanitized.

- **JSON** (`format=json`) uses `schemaVersion: 2`:
  ```json
  {
    "schemaVersion": 2,
    "exportedAt": "2026-10-25T00:00:00.000Z",
    "profile": { "username": "…", "displayName": "…", "headline": "…", "bio": "…", "avatarUrl": "…", "socials": {}, "isPublished": true, "url": "/…" },
    "appearance": { "theme": "default", "color": "#7c3aed", "background": "gradient", "card": "rounded", "button": "solid", "showAvatar": true, "showBio": true, "showSocial": true, "showDescription": true },
    "links": [{ "position": 1, "title": "…", "url": "…", "description": "…", "category": "…", "icon": "auto", "isActive": true, "createdAt": "…", "clicksLast365Days": 0 }],
    "categories": [{ "position": 1, "name": "…", "description": "…", "color": "#7c3aed", "icon": "folder", "isVisible": true }],
    "analytics": { "historyDays": 365, "totalClicks": 0, "daily": [{ "date": "2026-10-24", "clicks": 0 }] }
  }
  ```
  Sections can be omitted by the UI include toggles; the profile-only variant includes profile, appearance and links.
- **CSV** (`format=csv`) is a zip containing five files, each with a header row and UTF-8 content:
  - `profile.csv` — `name,username,headline,bio,avatar_url,url,published,website,github,linkedin,x,medium,email`
  - `links.csv` — `position,title,url,description,category,icon,active,created_at[,clicks_last_365_days]`
  - `categories.csv` — `position,name,description,color,icon,visible`
  - `daily_stats.csv` — `date,link_id,link_title,clicks`
  - `daily_breakdowns.csv` — `date,link_id,dimension,value,clicks`
  `daily_stats.csv` and `daily_breakdowns.csv` are included only when analytics is selected. Breakdown rows cover `country`, `device` and `referrer`; daily totals remain the source of truth if a breakdown allocation is rounded.
- **Formula injection:** every CSV cell beginning with `=`, `+`, `-`, `@`, tab or CR is prefixed with `'` before quoting; cells containing `"`, comma, LF or CR are quoted with doubled quotes. JSON is not executable and is emitted as-is. The zip is streamed and built in memory only for the free-plan size.

**Account deletion & restore (MVP).**

1. `DELETE /account` requires the current password and the exact username. It sets `deletion_scheduled_for = now() + 30 days`, sets `is_published = false`, revokes all sessions except the current one, and sends a restore link to the account email. The response returns `deletionScheduledFor`; repeated calls are idempotent.
2. The public profile is hidden immediately (unpublished). The owner can still sign in, export, change settings or restore during the grace period.
3. `POST /account/restore` consumes the single-use `account_restore` token (valid for the 30-day grace window, hashed at rest) and clears `deletion_scheduled_for`. An authenticated owner can also call `POST /account/cancel-deletion`, which clears the flag and invalidates any outstanding restore token. A successful login also clears it. Restoring never republishes the profile; the owner must publish again.
4. The nightly prune hard-deletes users whose `deletion_scheduled_for` has passed, cascading profiles, categories, links, `click_events`, `click_daily_stats`, `click_daily_breakdowns` and tokens, and deleting sessions by `sess->>'userId'`. It sets `status=deleted` immediately before the hard delete for audit clarity.
5. Audit-log scheduling, restore and purge. Deletion requests are not accepted by email once the self-serve flow ships; the contact address remains for abuse/privacy questions.

---

## 15. Observability

- `GET /api/v1/health` → `{ status, db, version, uptime }` (readiness; DB check). `GET /api/v1/health/live` → liveness only, so a DB outage does not trigger a restart loop.
- pino JSON logs (`LOG_LEVEL`); redact passwords, tokens, cookies, signatures, and request bodies on auth routes.
- `X-Request-Id` on every request/log/error; accept an inbound ID only if it matches a safe pattern, otherwise generate one.
- Error tracking (e.g. Sentry free tier) for API and web; nightly-job failures and repeated revalidation failures alert the owner.
- Audit log for account status changes, email changes (pending and confirmed), password changes, session revocations, deletion scheduled/restored/purged, username changes, and owner/admin actions; manual SQL changes are recorded in the runbook.
- Uptime monitor on `https://api.nayankunwar.com/api/v1/health` (and optionally `https://link.nayankunwar.com/api/v1/health` to cover the rewrite) (free tier, e.g. UptimeRobot) — Public launch.

---

## 16. Testing Plan

| Area | Tool | Cases |
|---|---|---|
| Validation | Vitest | URL schemes, username regex, reserved list (incl. every web route), Zod DTOs |
| Entitlements | Vitest | `LIMIT_REACHED` at `maxLinks`; soft-deleted rows do not count; two concurrent creates cannot exceed the limit; raw/history retention used by jobs |
| Auth | Supertest | login/logout, session regenerate, rate limit, CSRF required on login/register/forgot/reset; password length cap; unknown email performs dummy hash |
| Registration | Supertest | `ALLOW_SIGNUP=false` → 403; true → user `pending_verification`, unpublished profile, token row, mail sent (mock); duplicate email generic response; taken/reserved username 409 |
| Verification | Supertest | valid → `active`; reused → 400; expired → 400; tampered → 400; resend invalidates old; two concurrent consumes → exactly one succeeds |
| Password reset | Supertest | token flow, expiry, single-use, two concurrent consumes, all sessions revoked |
| Account lifecycle | Supertest | email change sets `pending_email` and sends only to the new address; old email remains valid until verification; reused/expired/tampered email-change tokens → 400; concurrent consumes → exactly one succeeds; password change revokes every other session but keeps the current one; session list/revoke is tenant-scoped; `DELETE /account` is idempotent, unpublishes immediately, revokes other sessions; login and restore token both clear `deletion_scheduled_for`; restore does not republish; purge hard-deletes after the grace period and leaves earlier accounts untouched |
| Account status | Supertest | pending blocked from links API (403); suspended cannot log in; suspending an active user kills the live session on next request; suspended profile 404 |
| Tenant isolation | Supertest | user B cannot read/update/delete/reorder A's links/categories, read A's profile settings, analytics or export → 404 |
| Cross-tenant references | Supertest | B creates a link with A's `categoryId` → 404, no row; B updates own link to A's `categoryId` → 404, link unchanged; reorder payload containing A's link/category IDs → 404, no order change; DB-level insert bypassing service violates the category composite FK and the analytics `(link_id, user_id)` composite FKs; deleting a category detaches its links (user_id intact) |
| Analytics job | Vitest + test DB | clearing `visitor_hash` leaves `click_events` row count and dashboard totals unchanged; rollup before vs after hash clearing → identical `click_daily_stats`; breakdowns for country/device/referrer match raw groupings; breakdown rows are written before raw purge; stale breakdown values are removed on recompute; rollup rerun is idempotent (same rows/counts, watermark unchanged); first run backfills historical raw days; purge never deletes days `> watermark` (simulate a missed rollup); dashboard totals/breakdowns equal before and after purge; per-user `rawEventRetentionDays` respected; short-retention user never has a purged day re-rolled to zero; concurrent second run exits on the run-level lock |
| Visitor hash | Vitest | same ip/ua/link same day → same hash; different link or day → different; daily key never persisted; `referrer_host` comes from the body's `document.referrer`, not the request `Referer` |
| Country code | Supertest | valid `X-Web-Proxy-Secret` + `x-vercel-ip-country` stores a two-letter code; missing/wrong secret ignores the header and stores null; lowercase/invalid values are rejected; direct API requests cannot spoof country; no IP is stored or logged |
| Proxy trust | Supertest | with configured `trust proxy`, spoofed leftmost `X-Forwarded-For` does not change `req.ip` |
| Usernames | Supertest | availability endpoint; rename revalidates old+new tags |
| Beacon parsing | Supertest | `text/plain` JSON accepted → 204 + row; `application/json`, malformed, oversized, bad UUID → 204, no row; bad Origin → 204, no row; rate-limited request → 204; bot UA ignored; dedupe window; body referrer host persisted, request `Referer` ignored |
| Revalidation | Vitest (route handler) | valid signature → 204 + `revalidateTag` called; bad signature, stale timestamp, bad tag → 401/400; rename revalidates old and new tags; replay within the window is bounded by the nonce cache if enabled; public profile fetch sends the internal token and is exempt from the public rate limit |
| Session store | Supertest + test DB | `connect-pg-simple` reads/writes the Prisma-created `sessions` table; `sess->>'userId'` index is used; status change/password reset deletes all user sessions; orphan sessions removed on user purge |
| Public DTO / cache | Supertest | public profile response contains no email/status/plan/user_id and no `Set-Cookie`; `Cache-Control` is public on the profile endpoint and `no-store` on auth/dashboard; internal-token fetch bypasses the public limiter |
| Export safety | Vitest | CSV cells starting with `= + - @` are escaped; zip contains the five CSVs (profile, links, categories, daily_stats, daily_breakdowns); JSON is `schemaVersion: 2`; export is tenant-scoped and excludes account email/password hashes/tokens/sessions |
| Theme/avatar | Vitest + Supertest | invalid theme keys/CSS are rejected; non-HTTPS or private-host avatar URLs are rejected; link URLs reject private/localhost/metadata hosts |
| Rate limits | Supertest | IPv6 addresses in the same /64 share a bucket; availability endpoint is limited; click limiter returns 204 |
| Accessibility | Playwright + axe | public profile and dashboard keyboard/focus/contrast; avatar alt text; no keyboard trap in reorder |
| SEO | Playwright | published profile has canonical/OG metadata; unpublished profile returns 404/noindex; sitemap excludes unpublished profiles |
| Routing | Playwright | `/dashboard` beats `[username]`; reserved paths (incl. `/check-inbox`, `/restore-account`, `/preview`) not resolved as profiles; `/` respects `ROOT_MODE`; `/robots.txt` and `/sitemap.xml` generated; `/preview` returns 404 when demo mode is off |
| E2E | Playwright | owner flow (login, CRUD, reorder, publish, view public page, click, analytics, export); registration → verify → create profile (signup enabled env); settings email/password/session flows; delete → restore → login; CSV zip has five files |

### Acceptance Criteria

- Owner logs in and manages everything; public page at `/nayan` (and `/` in `ROOT_MODE=profile`) serves from ISR during API cold start.
- Registered, verified users manage only their own data; all cross-tenant tests pass.
- Signup is impossible while `ALLOW_SIGNUP=false`.
- Login/register/forgot/reset reject missing/invalid CSRF or Origin; public profile responses never carry `Set-Cookie`.
- Unverified/suspended/deleted users are blocked per §7.3.
- Clicks recorded via beacon without affecting navigation; bots and repeats ignored; `referrer_host` reflects the external source, not the profile page.
- Revalidation only accepts signed, fresh requests; profile edits become visible within the documented ISR behavior; public pages remain cacheable.
- Public profile responses expose no account internals; CSV exports are formula-safe and contain the five v2 files.
- Analytics totals and country/device/referrer breakdowns are identical before/after purge and hash clearing; the nightly job is single-run and first-run safe.
- Account deletion hides the profile immediately, restore works via login or the emailed link during the 30-day grace period, and the purge hard-deletes only expired accounts.
- No excluded features present. No raw IPs stored.

---

## 17. Deployment

| Component | Host | Notes |
|---|---|---|
| Web | Vercel Hobby (or Cloudflare Pages) | ISR, `/api/*` rewrite, `/internal/revalidate`; Hobby is non-commercial — verify the plan fits a public multi-tenant service |
| API | Render free | Cold starts ~30–60 s; public pages unaffected (ISR); auth/dashboard requests can exceed the Vercel proxy timeout; upgrade for always-on |
| DB | Neon free | Pooled `DATABASE_URL`, `DIRECT_URL` for migrations; PITR window per plan; set a small `connection_limit` so Prisma + sessions do not exhaust connections |
| Email | Brevo free | Verified sending domain `nayankunwar.com` (SPF/DKIM/DMARC) |
| Jobs | GitHub Actions schedule | One nightly job (§11.3) at 03:00 UTC; Render's free plan has no cron jobs |
| DNS | `link.nayankunwar.com` → Vercel; `api.nayankunwar.com` → Render | |

**Scaling path (Later):** stateless API → multiple instances → Redis for rate limits/sessions → queue for click ingestion → partition `click_events` → custom domains via edge middleware.

**Cold starts and proxy timeouts:** ISR protects public pages, but login/register/dashboard calls go through the Vercel rewrite to Render. A Render free cold start (~30–60 s) can exceed the Vercel proxy/function timeout, so the first auth request after idle may fail. Keep the API warm with a 5-minute uptime ping, move to a paid always-on instance, or implement an explicit retry/loading UX. Do not rely on ISR for authenticated flows.

**Vendor limits:** Vercel Hobby is intended for personal, non-commercial use; confirm the plan fits a public multi-tenant service. Render's free plan has no cron jobs, so nightly analytics runs in GitHub Actions. Set `connection_limit` on `DATABASE_URL` and a small `pg` pool for `connect-pg-simple` so Prisma + sessions do not exhaust Neon connections.

**Staging and CI:** use a separate Neon branch and Vercel/Render preview environment with distinct secrets. CI runs lint, typecheck, unit tests, integration tests against a Postgres service, `prisma migrate deploy` on a throwaway DB, and the web build. Migrations are forward-only; take a `pg_dump`/PITR checkpoint before production migrations and document the forward-fix rollback.

### Deployment Checklist (private phase)

- [ ] Neon DB, `citext` extension, `prisma migrate deploy` in release step
- [ ] Owner seeded (strong password), profile `DEFAULT_USERNAME` published
- [ ] `SESSION_SECRET`, `REVALIDATE_SECRET`, `ANALYTICS_HASH_SECRET`, `WEB_PROXY_SECRET` ≥ 32 random bytes, distinct
- [ ] `ALLOW_SIGNUP=false`, `ROOT_MODE=profile`, `ALLOW_DEMO_PREVIEW=false`
- [ ] Web rewrite adds `X-Web-Proxy-Secret`; API stores country only when it matches; direct API country spoof is ignored
- [ ] Account deletion/restore emails delivered; purge job scheduled and tested against a throwaway account; restore link and login both cancel deletion
- [ ] Export verified as `schemaVersion: 2` with five CSVs and formula-safe cells
- [ ] Rewrite `/api/:path*` only; `/internal/revalidate` reachable from API via `WEB_INTERNAL_URL`
- [ ] **Verify `TRUST_PROXY` (do not assume):**
  1. Temporarily enable `GET /api/v1/debug/ip` (`DEBUG_IP_ENDPOINT=true`; requires owner session) returning `req.ip`, `req.ips`, raw `X-Forwarded-For`, and `req.socket.remoteAddress` — or log the same fields once.
  2. Call it from a known client IP through `link.nayankunwar.com/api/...` (Vercel → Render path).
  3. Count proxy hops in `X-Forwarded-For` to the right of your real IP; set `TRUST_PROXY` to that number so `req.ip` equals your real IP. Repeat with a forged leading `X-Forwarded-For` header and confirm `req.ip` is unchanged.
  4. Check logs for `express-rate-limit` validation warnings; fix before proceeding.
  5. Set `DEBUG_IP_ENDPOINT=false` and redeploy.
- [ ] HTTPS enforced; Secure cookies; session table + `sess->>'userId'` expression index created by migration
- [ ] Dashboard `no-store` verified; public profile API cache headers verified and ISR fetch sends `X-Internal-Token`
- [ ] `INTERNAL_FETCH_TOKEN` set, distinct from other secrets; internal fetch exempt from the public limiter
- [ ] Cold-start behavior tested through the Vercel rewrite; keep-warm or paid API decision recorded
- [ ] Nightly analytics job scheduled; first-run watermark/backfill tested; Render liveness check path set to `/api/v1/health/live` (readiness `/api/v1/health` is for uptime monitoring)
- [ ] Error tracking and job-failure alerts configured; audit log path documented
- [ ] CI green (lint, typecheck, unit, integration, migration, build); staging uses a separate Neon branch
- [ ] Logs redact secrets and auth bodies
- [ ] Vendor ToS/quota reviewed (Vercel Hobby non-commercial, Render hours, Neon connections, Brevo daily limit)

---

## 18. Private → Public Release

The private phase runs the same code with `ALLOW_SIGNUP=false` and `ROOT_MODE=profile`. Going public is a controlled flip.

### Launch Checklist

- [ ] All **Public launch** items in §2.1 complete and tested
- [ ] Brevo domain verified (SPF/DKIM/DMARC); verification and reset emails delivered in production (incl. spam-folder check)
- [ ] Account-status checks verified in production
- [ ] Rate limits tuned and tested for register/login/forgot/resend/availability/clicks
- [ ] CSRF/Origin enforced on login/register/forgot/reset; token race tests pass
- [ ] Public profile DTO, cache headers, and ISR internal token verified
- [ ] ToS and Privacy pages published and linked from signup; self-serve deletion/restore flow documented and tested
- [ ] Account email change, password change and session revocation tested in production
- [ ] Export `schemaVersion: 2` with five CSVs verified; formula-injection cells escaped
- [ ] Analytics country/device/referrer breakdowns match raw totals; `WEB_PROXY_SECRET` country trust verified
- [ ] `ALLOW_DEMO_PREVIEW=false` and `/preview` returns 404 in production
- [ ] Abuse report path live (profile footer link → owner inbox)
- [ ] Landing page ready; set `ROOT_MODE=landing` and redeploy (build-time env); owner profile still at `/nayan`
- [ ] Owner account migration: confirm `role=owner`, `status=active`, `email_verified_at` set, `plan=free`; data migration script idempotent
- [ ] Reserved list reviewed against all current and planned routes
- [ ] SEO: profile metadata/canonical/OG, `sitemap.xml`, `robots.txt` verified
- [ ] Accessibility: keyboard drag-and-drop, focus states, contrast, avatar alt text checked
- [ ] Backups: Neon PITR confirmed; manual `pg_dump` taken before flip; restore tested once
- [ ] Monitoring: uptime on `/api/v1/health`, error tracking, job alerts, audit log, log review
- [ ] Load/quota check: Neon storage & compute hours, Vercel bandwidth/ISR, Render hours, Brevo daily limit (300/day free) — confirm headroom
- [ ] Cold-start behavior tested for signup/login; consider moving API off free tier
- [ ] Vendor ToS reviewed (Vercel Hobby non-commercial, Render free cold starts)
- [ ] Flip `ALLOW_SIGNUP=true`; smoke-test register → verify → publish → public page → click → analytics → export
- [ ] Rollback: set `ALLOW_SIGNUP=false` (no data loss); forward-fix migration plan documented

---

## 19. Environment Variables (`.env.example`)

```bash
# --- General ---
NODE_ENV=development
LOG_LEVEL=info
APP_URL=http://localhost:3000            # public web origin (prod: https://link.nayankunwar.com)

# --- Database (Neon) ---
DATABASE_URL=postgresql://user:pass@host/linkhub?sslmode=require&pgbouncer=true&connection_limit=5
DIRECT_URL=postgresql://user:pass@host/linkhub?sslmode=require

# --- API ---
PORT=4000
SESSION_SECRET=change-me-32-bytes-min
SESSION_MAX_AGE_DAYS=7
TRUST_PROXY=false                        # false/blank by default; set to the verified hop count in prod (§17); wrong value = IP spoofing or shared rate limits
DEBUG_IP_ENDPOINT=false                  # owner-only /api/v1/debug/ip, enable only during proxy verification
WEB_INTERNAL_URL=http://localhost:3000   # API → Next.js /internal/revalidate

# --- Web ---
API_BASE_URL=http://localhost:4000       # rewrite target (prod: https://api.nayankunwar.com)
NEXT_PUBLIC_APP_URL=https://link.nayankunwar.com  # canonical public origin used in metadata/links
NEXT_PUBLIC_ALLOW_SIGNUP=true            # UI flag only; the API enforces ALLOW_SIGNUP
ALLOW_DEMO_PREVIEW=false                 # true only for the local UI-first demo; enables /preview

# --- Shared (API + Web) ---
REVALIDATE_SECRET=change-me-32-bytes-min # signs /internal/revalidate, server-only
INTERNAL_FETCH_TOKEN=change-me-32-bytes-min # exempts ISR/build fetches from the public limiter
WEB_PROXY_SECRET=change-me-32-bytes-min  # web tier adds X-Web-Proxy-Secret; API trusts country header only with it

# --- Tenancy & features ---
DEFAULT_USERNAME=nayan
ROOT_MODE=profile                        # profile | landing
ALLOW_SIGNUP=false                       # true only at public launch
ACCOUNT_DELETION_GRACE_DAYS=30           # keep in sync with shared LIMITS.deleteGraceDays

# --- Email ---
EMAIL_PROVIDER=console                   # console | resend | brevo
EMAIL_FROM="Link Hub <no-reply@nayankunwar.com>"
EMAIL_RESEND_API_KEY=
EMAIL_BREVO_API_KEY=
EMAIL_VERIFICATION_TTL_HOURS=24
PASSWORD_RESET_TTL_MINUTES=60

# --- Analytics ---
CLICK_DEDUPE_SECONDS=30
ANALYTICS_HASH_SECRET=change-me-32-bytes-min   # derives in-memory daily dedupe key; never stored in DB

# --- Seed ---
SEED_OWNER_EMAIL=owner@nayankunwar.com
SEED_OWNER_PASSWORD=change-me-12-chars
```

Analytics raw/history retention comes from entitlements, not env. In production, startup env validation rejects known placeholders (values containing `change-me`), secrets shorter than 32 bytes, and equal secrets; `INTERNAL_FETCH_TOKEN` and `WEB_PROXY_SECRET` must differ from the session, revalidation and analytics secrets. `ALLOW_DEMO_PREVIEW` must be false in production; `NEXT_PUBLIC_ALLOW_SIGNUP` is display-only and never replaces the API's `ALLOW_SIGNUP` check. The seed password is development-only.

---

## 20. Implementation Phases

0. **Local dev, CI, staging** — pnpm workspace, Docker/Neon branch, `.env` bootstrap, GitHub Actions (lint, typecheck, unit, integration, migration, build), preview environment with a separate Neon branch.
1. **Foundation, schema, migrations, owner seed** — monorepo, shared package, full Prisma schema (incl. `verification_tokens`, `accounts`, `sessions`, `click_daily_stats`, `click_daily_breakdowns`, `deletion_scheduled_for`, `pending_email`), composite analytics FKs, analytics indexes, `citext`, `sessions` table + raw SQL expression index, seed, env validation, Express skeleton (request ID, logger, envelope, health/live), Next.js 16 with `/api/*` rewrite.
2. **Auth, registration infrastructure, session security, tenant isolation** — sessions, argon2id, CSRF/Origin on all non-GET, rate limits (IPv6-normalized), `loadUser` + status checks, register/verify/resend/forgot/reset endpoints behind `ALLOW_SIGNUP`, atomic token consumption, email change (`pending_email` + `email_change` token), password change, session list/revoke, account deletion/restore with 30-day grace, mailer (console + Brevo), `scoped()` repositories, atomic entitlements, cross-tenant test harness.
3. **Profiles, usernames, links, categories, dashboard** — username validation/availability/rename, profile headline/socials/appearance, link and category CRUD/reorder/status/icon, category description/color/visibility, search/filter, appearance/theme validation, export v2 with five CSVs and formula escaping, dashboard UI (`no-store`), settings UI, signup/verify/reset/check-inbox/restore-account pages.
4. **Public pages, click analytics, cache revalidation** — `[username]` ISR, `ROOT_MODE`, beacon + `text/plain` endpoint with body referrer, trusted country header, bot filter, dedupe, always-204 handlers, analytics endpoints + breakdowns + Recharts, HMAC `/internal/revalidate`, ISR internal token/cache headers, run-level job lock, watermark backfill, totals → breakdowns → clear hashes → purge → prune, SEO metadata/sitemap/robots.
5. **Testing, security review, deployment, public-launch readiness** — full test matrix (§16), Playwright E2E, accessibility check, security review, error tracking/audit, staging deploy, production deploy (private), ToS/Privacy, landing page, abuse report path, deletion/restore and email-change verification, launch checklist (§18).

---

## 21. Later (deferred until explicitly approved)

Billing/paid plans · OAuth (Google/GitHub) · custom domains · advanced moderation/admin console · Safe Browsing screening · CAPTCHA · notification preferences · Redis · analytics queue · `click_events` partitioning · unique-visitor analytics · timezone-aware analytics · additional themes · multiple link pages per user.

### 21.1 Design Note: Multiple Link Pages per User (Later)

Each user could own several shareable pages, e.g. `/nayan` (default) and `/nayan/projects`, each with its own title, description and ordered links. **Not in the MVP schema or API.**

- **Table `pages`:** `id` (uuid PK), `user_id` (FK), `slug` (unique per user: `@@unique([userId, slug])`), `title`, `description`, `is_default` (one per user, partial unique index), `is_published`, `sort_order`, `created_at`, `updated_at`, `deleted_at`.
- **Link membership:** add nullable `links.page_id` (ownership-checked in the service and backed by a composite FK `(page_id, user_id) → pages(id, user_id)`, same pattern as categories) (null = default page) if each link lives on one page; use a `page_links(page_id, link_id, sort_order)` join table instead if a link must appear on several pages. Decide at approval time.
- **Routing:** `/:username` → default page; `/:username/:pageSlug` → named page (Next.js `app/[username]/[pageSlug]`). Public API `GET /api/v1/public/profiles/:username/pages/:pageSlug`.
- **Reserved page slugs:** same regex as usernames plus a list (e.g. `edit`, `settings`, `analytics`, `links`, `api`, `default`).
- **Migration:** the MVP treats each profile as one implicit default page; the migration creates a `pages` row (`is_default=true`, slug `home`) per user and backfills `links.page_id` (or `page_links`) preserving `sort_order`.
- **Tenant scope:** pages added to `scoped(userId)`; cross-tenant tests extended.
- **Revalidation:** tag `profile:<username>:<pageSlug>` per page (widen the §11.2 tag regex to `^profile:[a-z0-9-]{3,30}(:[a-z0-9-]{1,40})?$`), plus existing `profile:<username>` for the default page and profile-wide changes; rename of username or page slug revalidates old and new tags.
- **Entitlements:** `maxPages` (e.g. free = 1 until approved otherwise), enforced only via `lib/entitlements.ts`.
- **Analytics:** optional page breakdown via `link.page_id`; no change to click ingestion.

---

## 22. Instructions for the AI Coding Agent

1. This document is the source of truth. Build **MVP** and **Public launch** items in phase order; do **not** build **Later** items without explicit approval.
2. Never implement URL shortening, redirect slugs/endpoints, QR codes, billing or AI.
3. Auth is Express sessions in Postgres + argon2id. Do not add Auth.js/NextAuth. Next.js 16 uses `proxy.ts`; do not add `middleware.ts` on 16. The `sessions` table matches `connect-pg-simple` (`sid varchar(255)`, `sess json`, `expire timestamp(6)`), uses `createTableIfMissing: false`, and keeps the `sess->>'userId'` expression index.
4. Every owned query goes through `scoped(userId)`; `userId` only from the session; non-owned → 404. Write cross-tenant tests for every owned endpoint (links, categories, profile, analytics, export). Keep the composite FKs, including `(link_id, user_id) → links(id, user_id)` on analytics.
5. Enforce account status in `loadUser` on every authenticated request, not only at login.
6. All plan limits and retention through `lib/entitlements.ts` only. Limit checks are atomic and count only `deleted_at IS NULL`; raw-event retention and analytics history are separate.
7. Registration must return `403 SIGNUP_DISABLED` when `ALLOW_SIGNUP` is not `true`. Verification/reset tokens: random, hashed at rest, consumed atomically, expiring.
8. Usernames: lowercase, regex, reserved list from `packages/shared`; add every new top-level web route and metadata route to the reserved list.
9. Rewrite only `/api/*`. Revalidation lives at Next.js `POST /internal/revalidate`, HMAC-signed with timestamp; never call it from the browser; revalidate old and new tags on rename; await the call with a timeout.
10. Click tracking: same-origin `sendBeacon` with a string body (`text/plain`), `fetch keepalive` fallback, `express.text()` on that route only, Zod parse, Origin check, body `document.referrer` host, always 204 including rate-limit/parser/Origin failures. Anchors link directly to the original URL. `country_code` comes only from `x-vercel-ip-country` when `X-Web-Proxy-Secret` matches `WEB_PROXY_SECRET`.
11. Never store raw IPs; never log secrets or tokens. Visitor hash = HMAC-SHA256(daily key derived from `ANALYTICS_HASH_SECRET`, `ip|ua|linkId`); never persist the key. Raw events are retained per `rawEventRetentionDays`; hashes are nulled after 24 h. Country is a two-letter code from the trusted proxy header, never an IP lookup.
11a. Resolve every referenced ID (`categoryId`, reorder IDs, future `page_id`) through the scoped repository → 404 if not owned; keep the composite FKs; detach links in the category-delete transaction (no composite `SetNull`).
11b. Do not guess `TRUST_PROXY`; follow the verification steps in §17 and treat `express-rate-limit` validation warnings as errors. Normalize IPv6 rate-limit keys to /64.
11c. CSRF/Origin applies to all non-GET requests, including login/register/forgot/reset; bind or sign the CSRF token.
11d. Public profile responses are explicit DTOs and cacheable; auth/dashboard responses are `no-store`. Next.js public fetches send `X-Internal-Token` and are exempt from the public limiter.
11e. Validate theme/avatar/link URLs; reject private/localhost link hosts; escape CSV formula cells.
11f. Validate environment at startup and reject default/short/equal secrets in production.
12. Dashboard and authenticated API responses are `no-store`.
13. Shared Zod schemas in `packages/shared`; standard envelope everywhere; DTO mappers, never raw Prisma objects in public responses.
14. Keep it simple: no generic base classes, DI frameworks or speculative abstractions; stay within free tiers.
15. Each phase must pass lint, typecheck and tests before the next begins; add the §16 tests for token races, click 204 paths, composite FKs, cache headers, CSV/theme/avatar validation.
16. Use `nayankunwar.com` domains everywhere.
17. Do not use `prisma db push` in production; migrations only, with a backup/PITR checkpoint and a forward-fix plan.
18. Account lifecycle: email changes use `pending_email` + a single-use 24 h `email_change` token; password changes revoke all other sessions; session revoke is tenant-scoped; deletion schedules a 30-day grace (`deletion_scheduled_for`), unpublishes immediately, is idempotent, and is cancelled by login or a single-use restore token. Restoring never republishes. Only the prune job hard-deletes.
19. Export is `schemaVersion: 2` and, for CSV, exactly five files: `profile.csv`, `links.csv`, `categories.csv`, `daily_stats.csv`, `daily_breakdowns.csv`. Escape formula-leading cells. Never export account email, password hashes, sessions or tokens.
20. The UI-first milestone uses typed mocks and a demo `lh.sid` cookie; `/preview` must be gated by `ALLOW_DEMO_PREVIEW` and disabled in production. Replace mock auth with the API session, keep `proxy.ts` as a presence check only, and preserve the prototype layout, violet/Inter design, dashboard shell, phone preview and all approved states.
21. Analytics job order is fixed: totals → breakdowns → clear hashes → purge raw → prune. Breakdowns and totals must be identical before/after purge; never purge a day that has not been rolled up.

---

## 23. UI Surface & Prototype Parity (v2.4)

The production web app lives in `apps/web`; `link-hub-ui/` is the visual reference and its gallery page is **not** shipped. Every approved prototype screen is implemented against typed mocks (`lib/store.tsx`, `lib/mock-data.ts`, `lib/analytics.ts`) and will be wired to the API in the next phase without changing the component contracts.

| Route | Screen | Implemented behavior |
|---|---|---|
| `/` | Landing | Marketing hero, features, steps, FAQ, CTA, site header/footer and a static phone preview |
| `/login` | Sign in | Split auth layout; any email/password signs in except password `wrong`; `?next=` is honored; signing in clears a scheduled deletion |
| `/signup` | Create account | Split auth layout; username availability/reserved/invalid states; `NEXT_PUBLIC_ALLOW_SIGNUP=false` closes signup; success routes to `/check-inbox` |
| `/forgot-password`, `/reset-password` | Recovery | Request, expired-token, invalid-password and success states |
| `/verify-email` | Verification | Verifying, success, expired and already-verified states |
| `/check-inbox` | Verification pending | Resend cooldown, change-email form, success/expired states |
| `/restore-account` | Restore | Scheduled, restored, active/nothing-to-restore and expired states; restores without republishing |
| `/dashboard` | Overview | Range selector, stat cards, Recharts click chart, top links, links table, toggles and phone preview |
| `/dashboard/links` | Links | Search/filter/sort, dnd-kit pointer reorder plus direct ↑/↓ keyboard reorder, add/edit dialog, delete confirmation, 50-link limit, `?q/add/edit` deep links |
| `/dashboard/categories` | Categories | Stats, CRUD dialog, description/color/icon/visibility, dnd-kit + keyboard reorder, delete detaches links, 20-category limit |
| `/dashboard/appearance` | Appearance | Draft state, theme preset, primary color, background, card/button styles, visibility toggles, live phone preview, reset/save, unsaved-changes warning |
| `/dashboard/analytics` | Analytics | Range selector, stats, chart, traffic/devices/countries/insights, per-link table, `?linkId=` filter banner, fallback skeleton |
| `/dashboard/export` | Export | Format cards, include checkboxes, never-included notice, JSON/ZIP generation, preview, copy, download, size label; ZIP has five CSVs |
| `/dashboard/profile` | Profile | URL-only avatar, headline/bio/username/socials, mock availability check, publish toggle, copy/open public URL, unsaved warning, 30-day deletion dialog, restore banner |
| `/settings` | Settings | Account/Security/Preferences/Notifications tabs, pending email, password change, session revoke one/all, read-only UTC note, account summary |
| `/[username]` | Public profile | Themed profile from the mock store; unknown and unpublished usernames show the same unavailable page |
| `/terms`, `/privacy`, `not-found` | Legal / 404 | Shared marketing shell and accessible content |
| `/preview` | Demo entry | Sets `lh.sid=demo-preview` and redirects to `/dashboard`; gated by `ALLOW_DEMO_PREVIEW` |

**Cross-cutting implementation notes**

- The mock store persists to `localStorage` key `linkhub-demo-v2`; analytics are deterministic over 365 UTC days from `MockLink.baseWeight`; new links start at zero clicks.
- Mock auth accepts any email/password except `wrong`; signup is enabled by default through `NEXT_PUBLIC_ALLOW_SIGNUP`; the demo cookie is `lh.sid=demo-preview`.
- `proxy.ts` guards `/dashboard/**` and `/settings/**` by cookie presence only; the API remains the identity authority.
- Design language: Inter, violet primary (`#7c3aed`), rounded 2xl cards, soft violet surfaces, focus rings, `aria-live` status text, labelled controls, keyboard reorder and dialog focus management.
- API wiring: replace `useMockData` reads with server queries/DTOs, keep the shared Zod schemas as the single validation contract, move export generation to `/export`, switch the public page to ISR, and remove the mock cookie/`/preview` before public launch.
