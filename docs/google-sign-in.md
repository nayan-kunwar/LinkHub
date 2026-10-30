# Google sign-in and sign-up

Status: live in production since 2026-10-30. Both client-ID variables are set,
and Google sign-in plus Google-first sign-up are working. The OAuth consent
screen is intentionally still in **Testing** with all three scopes configured;
it must be published before public Google sign-up.

This feature lets an existing Link Hub account sign in with Google and lets a
new user create an account with Google. Sign-up is Google-first, then one
editable **Choose your LinkHub URL** screen. It never auto-links an existing
email account, never asks for a Google password, and only creates accounts when
`ALLOW_SIGNUP=true`.

## Scope and decisions

| Decision | Choice |
|---|---|
| Sign-in flow | Google Identity Services (GIS) ID-token flow in the browser; the API verifies the JWT directly with Google's JWKS |
| Account creation | Google-first sign-up behind `ALLOW_SIGNUP=true`; the user confirms one editable username |
| Sign-in for existing accounts | A Google subject must already be linked to a Link Hub user |
| Linking | Explicit action from **Settings → Connected accounts** while signed in with a password |
| Auto-link by verified email | Never. The API never links an existing account by Google email |
| Existing email during sign-up | `409 GOOGLE_ACCOUNT_EXISTS`; the user signs in with their password and links Google in Settings |
| Data stored | Google `sub` in `accounts.provider_account_id`; for Google-created accounts, Google email as `users.email` and Google name as the profile display-name prefill |
| Data not stored | Google picture, access token, refresh token, client secret. For linked existing accounts, Google email and name are not persisted |
| Password | Google-created accounts have no password until the user sets one in **Settings → Set a password** |
| Unlink | Allowed only when the user has a password; otherwise `409 LAST_SIGN_IN_METHOD` |
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
  ├── found     → create the normal server session, rotate CSRF, return /auth/me
  └── not found
      ├── email already has an account → 409 GOOGLE_ACCOUNT_EXISTS
      ├── ALLOW_SIGNUP=false           → 403 SIGNUP_DISABLED
      └── otherwise                    → 200 { signupRequired, email,
                                                displayName, suggestedUsername }
                                         (no session, no account)
  │
  │ 5. Claim screen: user edits/confirms the username
  ▼
POST /api/v1/auth/google/signup  { credential, username, remember? }
  │
  │ 6. Re-verify the token, check reserved/taken username, re-check email/sub
  │ 7. Transaction: users(status=active, email_verified_at) +
  │                 profiles(username, display_name) + accounts(google, sub)
  ▼
Create the normal server session, rotate CSRF, return /auth/me
```

The claim screen is the only place a username is chosen. The suggested value
is prefilled and fully editable; the API requires the confirmed username and
never silently assigns the suggestion.

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

For a Google-created account the transaction also writes:

- `users.email` — the verified Google email, normalized to lowercase.
- `users.status = active` and `users.email_verified_at` — Google already verified
  the address, so no Link Hub verification email is sent.
- `profiles.username` — the username the user confirmed on the claim screen.
- `profiles.display_name` — the Google name when present, otherwise a name
  derived from the email local part. The user can edit it later.

Migration: `prisma/migrations/20261028000000_google_accounts/migration.sql`.

`GET /api/v1/account` now also returns:

- `connectedProviders`: for example `["google"]`
- `hasPassword`: whether the user can still sign in without Google

## API endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| `POST` | `/api/v1/auth/google` | none (CSRF + Origin) | Body `{ credential, remember? }`; signs in a linked account, or returns claim data for a new one |
| `POST` | `/api/v1/auth/google/signup` | none (CSRF + Origin) | Body `{ credential, username, remember? }`; creates the account after the user confirms the username |
| `POST` | `/api/v1/auth/google/link` | session, active, verified email | Body `{ credential }`; links Google to the current user |
| `DELETE` | `/api/v1/auth/google` | session, active | Unlinks Google; blocked when no password remains |
| `GET` | `/api/v1/account` | session | Includes `connectedProviders` and `hasPassword` |

Both Google completion paths share the password-login completion path: session
regeneration, audit event, scheduled-deletion restore, `no-store`, and a fresh
CSRF token. `remember` follows the existing seven-day session option.

### Error codes

| Code | Status | Meaning |
|---|---|---|
| `GOOGLE_SIGN_IN_DISABLED` | 503 | `GOOGLE_CLIENT_ID` is not configured on the API |
| `GOOGLE_TOKEN_INVALID` | 401 | Signature, issuer, audience, age, subject or `azp` failed verification |
| `GOOGLE_EMAIL_UNVERIFIED` | 403 | Google returned `email_verified != true` |
| `GOOGLE_NOT_LINKED` | 403 | No Link Hub account is linked to this Google subject |
| `GOOGLE_ACCOUNT_EXISTS` | 409 | The Google email belongs to an existing account; sign in with the password and link Google in Settings |
| `GOOGLE_ALREADY_LINKED` | 409 | The user already has a Google link, or the subject belongs to another user |
| `SIGNUP_DISABLED` | 403 | `ALLOW_SIGNUP=false`; no Google account was created |
| `USERNAME_TAKEN` / `USERNAME_RESERVED` | 409 | The confirmed username is unavailable |
| `LAST_SIGN_IN_METHOD` | 409 | Unlink refused because the user has no password |

Rate limits:

- `POST /auth/google`: 10 attempts per 15 minutes per IP, successful requests skipped.
- `POST /auth/google/signup`: 5 attempts per hour per IP.
- `POST /auth/google/link` and `DELETE /auth/google`: 10 changes per hour per user.

## Environment variables

| Variable | Where | Required | Notes |
|---|---|---|---|
| `GOOGLE_CLIENT_ID` | Render API | No | Web application OAuth client ID; unset/empty disables the API routes with 503 |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Vercel web | No | Same value as `GOOGLE_CLIENT_ID`; build-time; unset hides the Google button |
| `ALLOW_SIGNUP` | Render API | No | Must be `true` for Google account creation; defaults to `false` |
| `NEXT_PUBLIC_ALLOW_SIGNUP` | Vercel web | No | Must be `true` for `/signup` to render; build-time. Keep it consistent with the API value |

No Google client secret is used or stored. The GIS ID-token flow does not need
one.

Local development: add the client IDs to the root `.env` and restart the API and
web dev servers. Both `NEXT_PUBLIC_*` values are inlined at build time, so a
production change requires a Vercel redeploy.

## Google Cloud setup (owner)

The OAuth app lives in **Google Cloud Console → APIs & Services → Google Auth
Platform**. The old **OAuth consent screen** entry redirects here. The page has
**Branding**, **Audience**, **Clients** and **Data Access** sections.

1. **Branding** — choose **External**; fill the app name, support email and
   developer contact.
2. **Data Access** — add the three scopes listed below.
3. **Audience** — while the app is in **Testing**, add every Google account
   that needs to sign in as a test user. Testing-mode refresh tokens expire
   after 7 days, but this flow does not store refresh tokens, so that limit
   does not affect sign-in.
4. **Clients → Create client → Web application**.
5. Authorized JavaScript origins:
   - `https://link.nayankunwar.com`
   - `http://localhost:3000`
6. No authorized redirect URI is needed for the GIS ID-token flow.
7. Copy the client ID (it ends with `.apps.googleusercontent.com`). Do **not**
   create or copy a client secret.
8. Set `GOOGLE_CLIENT_ID` on Render and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` on
   Vercel to the same value, then redeploy both.
9. Publish the consent screen before public launch; see **Publishing status**
   below.

### Scopes (Data Access)

Direct link: <https://console.cloud.google.com/auth/scopes>

The **Non-sensitive scopes** table must list all three:

| Console scope | Requested as | Why |
|---|---|---|
| `openid` | `openid` | Identifies the Google account for the ID-token flow |
| `.../auth/userinfo.email` | `email` | Verified email for new accounts and the existing-email conflict check |
| `.../auth/userinfo.profile` | `profile` | Google name used only to prefill a new profile's display name |

To add them, click **ADD OR REMOVE SCOPES**, select all three and click
**UPDATE**. If the picker does not list one, use **Manually add scopes** with
the full values:

- `openid`
- `https://www.googleapis.com/auth/userinfo.email`
- `https://www.googleapis.com/auth/userinfo.profile`

All three are non-sensitive, so no Google verification review is required. Do
not request Drive, Gmail or any other scope.

### Publishing status

As of 2026-10-30 the scopes are configured, but the app is deliberately still
in **Testing** for the private phase. Two consequences:

- Only Google accounts listed under **Audience → Test users** can complete
  sign-in or sign-up. Anyone else sees Google's "Access blocked" page.
- Google shows the consent screen only the first time an account grants access.
  To see it again, remove LinkHub at
  <https://myaccount.google.com/permissions> and sign in again.

Before public Google sign-up:

1. Confirm **Data Access** still lists all three scopes.
2. Open **Audience → Publish app**. These non-sensitive scopes do not require
   verification.
3. Re-test with a Google account that is **not** a test user. The consent
   screen should list the account name and email with no unconfigured-scope
   warning.

## Deploy order

1. Merge the PR.
2. Run the migration from a machine with the production `DIRECT_URL`:

   ```bash
   set -a; source .env.deploy.local; set +a
   pnpm db:deploy
   ```

3. Set `GOOGLE_CLIENT_ID` on Render (or leave it unset to keep the feature dark).
4. Set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` on Vercel to the same value.
5. Set `ALLOW_SIGNUP=true` on Render and `NEXT_PUBLIC_ALLOW_SIGNUP=true` on
   Vercel. Keep both values in sync; the web flag only controls whether
   `/signup` renders, while the API flag is the security boundary.
6. Redeploy the API and web app. The API restart is required for the new env
   vars; the web app must be rebuilt because `NEXT_PUBLIC_*` is inlined.
   Changing a Vercel environment variable does not rebuild an existing
   deployment.
7. Smoke-test both paths:
   - Sign in with a password, open **Settings → Connected accounts**, connect
     Google, sign out, then use **Sign in with Google**.
   - In a private window, open `/signup`, choose **Continue with Google**,
     confirm the suggested URL (or edit it), and land on the dashboard.
8. Confirm the audit log contains `account.registered` with
   `metadata.via = "google"`, `account.google_linked`, and `auth.login` with
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
- `email_verified` must be true. Sign-in uses the Google email only to detect an
  existing account and refuses to auto-link it. Sign-up uses the verified email
  as the new account's email; it never merges into an existing account.
- Login never creates a user. Account creation requires an explicit claim-screen
  submission, a confirmed username, and `ALLOW_SIGNUP=true`.
- The suggested username is editable and is re-checked inside the signup
  transaction. Reserved names return `USERNAME_RESERVED`; taken names return
  `USERNAME_TAKEN`.
- Google-created accounts have no password. **Settings → Set a password** uses
  the existing password endpoint without a current password, hashes the new
  password with argon2id, and revokes other sessions.
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
ALLOW_DEMO_PREVIEW=false pnpm build
```

Covered by `apps/api/src/lib/google.test.ts`,
`apps/api/src/modules/auth/google.service.test.ts` and
`apps/api/src/modules/auth/google.routes.test.ts`:

- valid token, both issuer spellings, wrong audience, wrong issuer, expired
  token, token older than 15 minutes, unverified email, missing
  `email_verified`, wrong `azp`, missing subject;
- linked login, signup-required response for an unlinked Google identity,
  existing-email conflict, suspended linked user;
- Google signup with a confirmed username, taken username, already-linked
  subject, active/verified user with no password;
- first-password setup without a current password, and a current-password
  requirement for accounts that already have one;
- explicit link, duplicate user link, subject already linked elsewhere,
  unverified user;
- unlink with a password, unlink blocked without a password;
- `connectedProviders`/`hasPassword` on the account DTO;
- CSRF, malformed credential, claim data, signup validation, session cookie and
  unauthenticated link/unlink routes.

Manual:

1. Sign in with a password.
2. Settings → Connected accounts → Continue with Google.
3. Confirm the row says **Connected**.
4. Sign out and use **Sign in with Google**.
5. Confirm the dashboard loads and the session appears under **Security**.
6. In a private window, open `/signup` and create an account with Google.
7. Confirm the claim screen prefills a suggested URL, that editing it changes
   the final handle, and that the dashboard loads without an email verification
   step.
8. Open Settings and confirm **Set a password** works without a current
   password; then sign out and sign in with that password.
9. Try the same Google account again; confirm it goes straight to the
   dashboard. Try a Google email that already has a password account; confirm
   the explicit-link message.
10. Disconnect Google in Settings and confirm password sign-in still works.
11. Try to disconnect when `password_hash` is null (test database only); confirm
    `LAST_SIGN_IN_METHOD`.
12. Remove LinkHub at <https://myaccount.google.com/permissions>, then sign in
    again with Google. The consent screen should list the account name and
    email and should not warn about an unconfigured scope.

## Privacy

Google-created accounts store the verified Google email as the account email and
the Google name as the initial profile display name. Linked existing accounts
store only the Google subject (`sub`). In both cases Link Hub does not receive
the Google password and does not store Google access tokens, refresh tokens,
pictures or client secrets. Google processes the authentication under its own
terms. The public privacy policy describes this data use.

## Related

- [`../DEPLOYMENT.md`](../DEPLOYMENT.md) — deployment order and environment variables.
- [`external-services.md`](external-services.md) — service inventory and secrets register.
- [`../link-hub-architecture.md`](../link-hub-architecture.md) — auth design and API contracts.
