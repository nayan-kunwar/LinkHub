# Nightly analytics trigger

Status: implemented; manual and first automatic runs verified.

Last updated: 2026-10-28.

This document records the 2026-10-27 migration of the nightly analytics job
from GitHub's `schedule` trigger to an external cron-job.org dispatch with a
Healthchecks.io dead-man's switch.

## Why the trigger changed

The workflow previously ran from GitHub's `schedule` trigger at 03:00 UTC. On
2026-10-27 that run never appeared: there were zero `schedule`-triggered runs
through 04:20 UTC while GitHub Status reported Actions operational. GitHub's
scheduled workflows are best-effort and can be delayed or dropped, especially
at the top of the hour.

Constraints:

- Render Free has no cron jobs, and the job must not run inside a Render request
  (cold start measured at 57.1 s; cron-job.org's default timeout is 30 s).
- The job must stay in GitHub Actions.
- Everything must stay on free tiers.

Decision: cron-job.org dispatches the existing GitHub workflow, GitHub Actions
runs the job, and Healthchecks.io alerts when a successful run is missing. The
GitHub `schedule` trigger was removed so there is one documented trigger.

## Architecture

```text
cron-job.org  (daily 03:17 UTC, free)
      │  POST workflow_dispatch + fine-grained PAT
      ▼
GitHub Actions  "Nightly analytics"
      │
      ├─ success ──► ping Healthchecks.io
      └─ failure ──► open/update `nightly-failure` issue

Healthchecks.io ──► owner email if no success ping by about 05:17 UTC
Manual recovery ──► Actions → Run workflow, or `gh workflow run`
```

The job does not depend on Render being awake, and it is idempotent: it takes a
PostgreSQL advisory lock and uses upserts/watermarks, so a duplicate or manual
run is safe.

## Configuration

### cron-job.org

| Field | Value |
|---|---|
| Job | `LinkHub nightly analytics` |
| Job ID | `8732512` |
| URL | `https://api.github.com/repos/nayan-kunwar/LinkHub/actions/workflows/396782571/dispatches` |
| Schedule | `17 3 * * *` |
| Timezone | UTC |
| Method | `POST` |
| `Accept` | `application/vnd.github+json` |
| `Authorization` | `Bearer <fine-grained PAT>` |
| `X-GitHub-Api-Version` | `2026-03-10` |
| `Content-Type` | `application/json` |
| Body | `{"ref":"main"}` |

A successful dispatch returns **`200 OK` or `204 No Content`**. GitHub has
returned both; confirm a new run appears in Actions rather than relying on the
status code alone. Enable **Save responses in job history** so the response is
visible later, and keep the job **enabled**.

### GitHub PAT

- Fine-grained token, repository access limited to `LinkHub`.
- Permission: **Actions: Read and write**.
- Expires **2027-01-25 07:08 UTC**.
- Stored only in cron-job.org. Never commit it or paste it into an issue.
- The response header `x-accepted-github-permissions: actions=write` confirms
  the token has the required permission.

### GitHub Actions workflow

`.github/workflows/analytics-nightly.yml`:

- Trigger: `workflow_dispatch` only. The `schedule:` block was removed.
- Steps: checkout → pnpm → Node → install → `pnpm db:generate` →
  `pnpm job:analytics` → **Ping heartbeat** → failure issue.
- The heartbeat step runs only on success and uses `continue-on-error: true`; a
  failed ping must not mark an otherwise successful job as failed. The missing
  ping is itself the alert.
- Repository secrets: `DATABASE_URL`, `DIRECT_URL`, `HEARTBEAT_URL`.
- The workflow receives no signing, proxy, or analytics secrets.

### Healthchecks.io

| Field | Value |
|---|---|
| Check | `LinkHub nightly analytics` |
| Schedule | Cron `17 3 * * *`, UTC (or Simple: period 1 day) |
| Grace | 2 hours |
| Alert | Owner email at about 05:17 UTC if no success ping arrives |
| Ping | Success-only HTTP request from the workflow; body contains the run URL |

The check was created and the `HEARTBEAT_URL` secret was set on 2026-10-27. The
first ping succeeded in run `40463090302`.

## Verification evidence

| Time (UTC) | Event | Result |
|---|---|---|
| 2026-10-27 04:25 | Manual run `40449642349` | Success; before the workflow change |
| 2026-10-27 06:46 | Manual run `40463090302` | Success; `Ping heartbeat` succeeded |
| 2026-10-27 07:34 | cron-job.org test run | `200 OK`; created run `40467931426` |
| 2026-10-27 07:34 | Run `40467931426` | Success; `Ping heartbeat` succeeded; failure step skipped |
| 2026-10-28 03:17 | First automatic cron-job.org run | Run `40625796861`; success; `Ping heartbeat` succeeded; failure step skipped |

The cron-job.org test response included:

- `x-accepted-github-permissions: actions=write`
- `github-authentication-token-expiration: 2027-01-25 07:08:55 UTC`

## Runbook

### Test without waiting

1. **cron-job.org → job → Test run**. Expect `200`/`204` and a new run in
   GitHub Actions.
2. Or dispatch manually:

   ```bash
   gh workflow run analytics-nightly.yml -R nayan-kunwar/LinkHub
   ```

3. Confirm the run's `Ping heartbeat` step succeeds. Healthchecks should show a
   new ping.

### Rotate the PAT

1. Create a new fine-grained PAT with the same scope: `LinkHub` only,
   **Actions: Read and write**, with an expiry.
2. Update the `Authorization` header in the cron-job.org job.
3. Run **Test run**; confirm a new workflow run appears.
4. Revoke the old token.
5. Update the expiry date in this document.

### Recover from a missed run

1. Healthchecks emails at about 05:17 UTC when no success ping arrives.
2. Check the cron-job.org execution history:
   - `401` — token invalid or expired; rotate the PAT.
   - `404` — token cannot see the private repo or lacks Actions access.
   - No execution — job disabled, schedule changed, or cron-job.org outage.
3. Dispatch manually with `gh workflow run` or the Actions UI.
4. Confirm the run succeeds and the heartbeat resets.

### Failure modes

| Failure | Detected by | Recovery |
|---|---|---|
| cron-job.org misses or is down | Healthchecks no-ping at ~05:17 | Manual dispatch; check cron-job.org history |
| Dispatch returns non-2xx | cron-job.org failure email | Check PAT, repo access, GitHub status |
| PAT expired | `401`; heartbeat no-ping | Rotate PAT |
| Job fails | `nightly-failure` issue; heartbeat no-ping | Inspect log; rerun (idempotent) |
| GitHub Actions outage | Heartbeat no-ping | Wait; dispatch when recovered |
| Neon unavailable | Job failure; heartbeat no-ping | Wait/restore; rerun |

## Open items

- [x] Confirm the cron-job.org job is **enabled** and the next execution is
      2026-10-28 03:17 UTC. Verified by the automatic run on 2026-10-28.
- [ ] Confirm the Healthchecks check uses daily 03:17 UTC with 2 hours grace.
- [x] Verify the first automatic run on 2026-10-28 at 03:17 UTC: run
      `40625796861` succeeded and pinged the heartbeat.
- [ ] Rotate the PAT before 2027-01-25.

## Commits

- `651e300` — `ops: trigger nightly job from cron-job.org with heartbeat`
- `b58cb91` — `docs: record heartbeat verification`

## Related

- [`DEPLOYMENT.md`](../DEPLOYMENT.md) — deployment runbook, nightly analytics and monitoring.
- [`docs/external-services.md`](external-services.md) — inventory of vendors, free-tier limits and failure impact.
- [`link-hub-architecture.md`](../link-hub-architecture.md) — §11.3 (job design) and §15 (observability).
- [`.github/workflows/analytics-nightly.yml`](../.github/workflows/analytics-nightly.yml) — workflow definition.
- [`apps/api/src/jobs/analytics-nightly.ts`](../apps/api/src/jobs/analytics-nightly.ts) — job implementation.
