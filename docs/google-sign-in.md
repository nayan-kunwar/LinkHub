# Google sign-in

Status: implemented on `feat/google-sign-in`; **disabled until the owner creates
a Google OAuth client and sets both environment variables**.

This feature lets an existing Link Hub account sign in with Google. It does not
create accounts, does not auto-link by email, and does not use a Google client
secret. It is intentionally compatible with the private phase:
`ALLOW_SIGNUP=false` stays in force.

## Scope and decisions

| Decision | Choice |
|---|---|
| Sign-in flow | Google Identity Services (GIS) ID-token flow in the browser; the API verifies the JWT directly with Google's JWKS |
| Account creation | Not supported. A Google subject must already be linked to a Link Hub user |
| Linking | Explicit action from **Settings → Connected accounts** while signed in with a password |
| Auto-link by verified email | Never. The API never looks up a user by the Google email |
| Data stored | Google `sub` only, in `accounts.provider_account_id` |
| Data not stored | Google email, name, picture, access token, refresh token, client secret |
| Unlink | Allowed only when the user still has a password; otherwise `409 LAST_SIGN_IN_METHOD` |
| Signup | Deferred until `ALLOW_SIGNUP=true`; a Google signup flow is out of scope |
| Transport | Same-origin `POST` through the Vercel `/api/*` rewrite, so the existing Origin and CSRF checks apply |

The API is the single identity authority. NextAuth/Auth.js is not used.

## Flow

```text
Browser (link.nayankunwar.com)
  │
  │ 1. GIS renders Google's button
  │ 2. User chooses a Google account
  ▼
Google Identity Services
  │
  │ 3. credential = Google ID token (JWT)
  ▼
POST /api/v1/auth/google  { credential, remember? }
  │
  │ 4. Verify RS256 signature with Google JWKS
  │    - issuer: accounts.google.com or https://accounts.google.com
  │    - audience: GOOGLE_CLIENT_ID (exact)
  │    - max token age: 15 minutes
  │    - email_verified = true
  │    - optional azp must match the client ID
  ▼
Find accounts(provider = 'google', provider_account_id = sub)
  │
  ├── not found → 403 GOOGLE_NOT_LINKED (no email lookup, no user creation)
  └── found     → create the normal server session, rotate CSRF, return /auth/me
```

Linking uses the same verifier, but requires an authenticated, active account
with a verified email:

```text
Settings → Connected accounts → Continue with Google
  → POST /api/v1/auth/google/link { credential }
  → reject if this user already has a Google link
  → reject if this Google subject is linked to another user
  → insert accounts(user_id, 'google', sub)
```

## Data model

`Account` already existed in the schema. This feature adds one constraint:

```prisma
model Account {
  id                String @id @default(uuid()) @db.Uuid
  userId            String @map("user_id") @db.Uuid
  provider          String
  providerAccountId String @map("provider_account_id")

  user              User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId]) // one Google subject → one user
  @@unique([userId, provider])             // one Google link per user
  @@map("accounts")
}
```

Migration: `prisma/migrations/20261028000000_google_accounts/migration.sql`.

`GET /api/v1/account` now also returns:

- `connectedProviders`: for example `["google"]`
- `hasPassword`: whether the user can still sign in without Google

## API endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| `POST` | `/api/v1/auth/google` | none (CSRF + Origin) | Body `{ credential, remember? }`; signs in an already-linked account |
| `POST` | `/api/v1/auth/google/link` | session, active, verified email | Body `{ credential }`; links Google to the current user |
| `DELETE` | `/api/v1/auth/google` | session, active | Unlinks Google; blocked when no password remains |
| `GET` | `/api/v1/account` | session | Includes `connectedProviders` and `hasPassword` |

The Google sign-in route uses the same login-completion path as password login:
session regeneration, audit event, scheduled-deletion restore, `no-store`, and a
fresh CSRF token. `remember` follows the existing seven-day session option.

### Error codes

| Code | Status | Meaning |
|---|---|---|
| `GOOGLE_SIGN_IN_DISABLED` | 503 | `GOOGLE_CLIENT_ID` is not configured on the API |
| `GOOGLE_TOKEN_INVALID` | 401 | Signature, issuer, audience, age, subject or `azp` failed verification |
| `GOOGLE_EMAIL_UNVERIFIED` | 403 | Google returned `email_verified != true` |
| `GOOGLE_NOT_LINKED` | 403 | No Link Hub account is linked to this Google subject |
| `GOOGLE_ALREADY_LINKED` | 409 | The user already has a Google link, or the subject belongs to another user |
| `LAST_SIGN_IN_METHOD` | 409 | Unlink refused because the user has no password |

Rate limits:

- `POST /auth/google`: 10 attempts per 15 minutes per IP, successful requests skipped.
- `POST /auth/google/link` and `DELETE /auth/google`: 10 changes per hour per user.

## Environment variables

| Variable | Where | Required | Notes |
|---|---|---|---|
| `GOOGLE_CLIENT_ID` | Render API | No | Web application OAuth client ID; unset/empty disables the API routes with 503 |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Vercel web | No | Same value as `GOOGLE_CLIENT_ID`; build-time; unset hides the Google button |

No Google client secret is used or stored. The GIS ID-token flow does not need
one.

Local development: add both values to the root `.env` and restart the API and
web dev servers. The web value is inlined at build time, so a production change
requires a Vercel redeploy.

## Google Cloud setup (owner)

1. Open **Google Cloud Console → APIs & Services → OAuth consent screen**.
2. Choose **External**; fill the app name, support email and developer contact.
3. Add scopes `openid` and `email` only. Do not request profile, Drive, Gmail or
   any other scope.
4. While the app is in **Testing**, add the owner's Google account as a test
   user. Testing-mode refresh tokens expire after 7 days, but this flow does not
   store refresh tokens, so that limit does not affect sign-in.
5. **Credentials → Create credentials → OAuth client ID → Web application**.
6. Authorized JavaScript origins:
   - `https://link.nayankunwar.com`
   - `http://localhost:3000`
7. No authorized redirect URI is needed for the GIS ID-token flow.
8. Copy the client ID (it ends with `.apps.googleusercontent.com`). Do **not**
   create or copy a client secret.
9. Set `GOOGLE_CLIENT_ID` on Render and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` on
   Vercel to the same value, then redeploy both.
10. Publish the consent screen before public launch. Testing mode is fine for
    the private phase.

## Deploy order

1. Merge the PR.
2. Run the migration from a machine with the production `DIRECT_URL`:

   ```bash
   set -a; source .env.deploy.local; set +a
   pnpm db:deploy
   ```

3. Set `GOOGLE_CLIENT_ID` on Render (or leave it unset to keep the feature dark).
4. Set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` on Vercel to the same value.
5. Redeploy the API and web app. The API restart is required for the new env
   var; the web app must be rebuilt because `NEXT_PUBLIC_*` is inlined.
6. Sign in with a password, open **Settings → Connected accounts**, connect
   Google, sign out, then use **Sign in with Google**.
7. Confirm the audit log contains `account.google_linked` and `auth.login` with
   `metadata.method = "google"`.

## Rollback

- **Disable sign-in without a deploy:** remove `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
  from Vercel and redeploy the web app; the button disappears. Remove
  `GOOGLE_CLIENT_ID` from Render to make the API return 503. Existing
  `accounts` rows remain; users can still sign in with their passwords.
- **Remove a link:** a signed-in user can disconnect Google in Settings. The API
  refuses to remove the only sign-in method.
- **Revert the feature:** deploy the previous commit. The extra unique index is
  additive and does not break the old code.

## Security notes

- The API verifies the Google JWT locally; it does not trust a client-supplied
  email, name or `sub` without a signature check.
- `aud` must exactly equal `GOOGLE_CLIENT_ID`; `iss` must be one of Google's two
  spellings; `alg` is restricted to `RS256`.
- `maxTokenAge` is 15 minutes, with 30 seconds of clock tolerance.
- `email_verified` must be true. The email is used only for that check; it is
  never persisted or used to find an account.
- Login never creates a user and never auto-links. An unlinked Google account
  receives `GOOGLE_NOT_LINKED` and is told to sign in with a password and link
  from Settings.
- Linking requires an active account with `email_verified_at` set. Both unique
  constraints are checked; a race is converted from Prisma `P2002` to
  `GOOGLE_ALREADY_LINKED`.
- Unlinking checks `password_hash` and returns `LAST_SIGN_IN_METHOD` when Google
  is the only way in.
- The Google credential is redacted from logs (`*.credential`) and is never
  written to the database, audit log or session.
- CSP allows only Google's GIS script, style, frame and connect origins. COOP
  is `same-origin-allow-popups` so the GIS popup can post the credential back
  while the opener remains isolated from other origins.
- The existing Origin check, signed double-submit CSRF, session regeneration,
  `no-store`, audit events and rate limits apply unchanged.

## Testing

Automated:

```bash
pnpm db:generate
pnpm typecheck:all
pnpm api:test
pnpm build
```

Covered by `apps/api/src/lib/google.test.ts`,
`apps/api/src/modules/auth/google.service.test.ts` and
`apps/api/src/modules/auth/google.routes.test.ts`:

- valid token, both issuer spellings, wrong audience, wrong issuer, expired
  token, token older than 15 minutes, unverified email, missing
  `email_verified`, wrong `azp`, missing subject;
- linked login, unlinked login with no email lookup, suspended linked user;
- explicit link, duplicate user link, subject already linked elsewhere,
  unverified user;
- unlink with a password, unlink blocked without a password;
- `connectedProviders`/`hasPassword` on the account DTO;
- CSRF, malformed credential, unlinked route response and unauthenticated
  link/unlink routes.

Manual:

1. Sign in with a password.
2. Settings → Connected accounts → Continue with Google.
3. Confirm the row says **Connected**.
4. Sign out and use **Sign in with Google**.
5. Confirm the dashboard loads and the session appears under **Security**.
6. Disconnect Google in Settings and confirm password sign-in still works.
7. Try a Google account that is not linked; confirm the explanatory error.
8. Try to disconnect when `password_hash` is null (test database only); confirm
   `LAST_SIGN_IN_METHOD`.

## Privacy

Update the privacy policy when the feature is enabled: Link Hub stores the
Google account identifier (`sub`) for linked accounts. It does not receive the
Google password and does not store Google access tokens, refresh tokens, email,
name or profile picture. Google processes the sign-in under its own terms.

## Related

- [`../DEPLOYMENT.md`](../DEPLOYMENT.md) — deployment order and environment variables.
- [`external-services.md`](external-services.md) — service inventory and secrets register.
- [`../link-hub-architecture.md`](../link-hub-architecture.md) — auth design and API contracts.
