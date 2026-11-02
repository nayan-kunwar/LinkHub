import "dotenv/config";
import { pathToFileURL } from "node:url";
import pg from "pg";
import type { Plan } from "@prisma/client";
import { audit } from "../lib/audit";
import { entitlementsFor } from "../lib/entitlements";
import { logger } from "../lib/logger";

const JOB_NAME = "analytics_rollup";
const LOCK_NAME = "analytics-nightly";
const BATCH_SIZE = 5_000;

const DIMENSIONS = {
  country: "country_code",
  device: "device_type",
  referrer: "referrer_host",
} as const;

type Dimension = keyof typeof DIMENSIONS;

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseDateOnly(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

export interface RollupOptions {
  /** Injectable clock for tests; production uses the current time. */
  now?: Date;
  /** Optional first day to recompute (inclusive). Overrides the watermark window. */
  from?: Date;
  /** Last day to recompute (inclusive); defaults to yesterday in UTC. */
  through?: Date;
  /** Set false for tests that must not touch the shared watermark row. */
  updateWatermark?: boolean;
}

export async function rollup(
  client: pg.Client,
  options: RollupOptions = {},
): Promise<{ days: number; watermark: string }> {
  const now = options.now ?? new Date();
  const yesterday = addDays(startOfUtcDay(now), -1);
  const through = options.through
    ? startOfUtcDay(options.through)
    : yesterday;

  await client.query("BEGIN");
  try {
    let day: Date;
    if (options.from) {
      day = startOfUtcDay(options.from);
    } else {
      await client.query(
        `
          INSERT INTO job_state (name, watermark, updated_at)
          SELECT
            $1,
            COALESCE(
              (SELECT (MIN(clicked_at) AT TIME ZONE 'UTC')::date - 1 FROM click_events),
              (now() AT TIME ZONE 'UTC')::date - 1
            ),
            now()
          WHERE NOT EXISTS (SELECT 1 FROM job_state WHERE name = $1)
        `,
        [JOB_NAME],
      );

      const state = await client.query<{ watermark: string }>(
        `SELECT watermark::text AS watermark FROM job_state WHERE name = $1`,
        [JOB_NAME],
      );
      const watermarkText = state.rows[0]?.watermark;
      if (!watermarkText) {
        throw new Error("The analytics watermark row could not be created.");
      }

      const watermark = parseDateOnly(watermarkText);
      // Re-cover two days before the watermark so late inserts are recomputed.
      day = addDays(watermark, -2);
    }

    let rolledUpDays = 0;

    for (; day.getTime() <= through.getTime(); day = addDays(day, 1)) {
      const dayText = dateOnly(day);
      const nextText = dateOnly(addDays(day, 1));

      const exists = await client.query<{ has_events: boolean }>(
        `
          SELECT EXISTS (
            SELECT 1
            FROM click_events
            WHERE clicked_at >= ($1::date::timestamp AT TIME ZONE 'UTC')
              AND clicked_at < ($2::date::timestamp AT TIME ZONE 'UTC')
          ) AS has_events
        `,
        [dayText, nextText],
      );

      // Never overwrite a rolled-up day with zeros when its raw events have
      // already been purged. The free plan's 90-day retention makes this safe
      // for the two-day re-cover window.
      if (!exists.rows[0]?.has_events) continue;

      await client.query(
        `
          INSERT INTO click_daily_stats (link_id, user_id, day, count, unique_count)
          SELECT
            link_id,
            user_id,
            $1::date,
            count(*)::int,
            CASE
              WHEN count(visitor_hash) = 0 THEN NULL
              ELSE count(DISTINCT visitor_hash)::int
            END
          FROM click_events
          WHERE clicked_at >= ($1::date::timestamp AT TIME ZONE 'UTC')
            AND clicked_at < ($2::date::timestamp AT TIME ZONE 'UTC')
          GROUP BY link_id, user_id
          ON CONFLICT (link_id, day) DO UPDATE SET count = EXCLUDED.count
        `,
        [dayText, nextText],
      );

      for (const dimension of Object.keys(DIMENSIONS) as Dimension[]) {
        const column = DIMENSIONS[dimension];
        await client.query(
          `DELETE FROM click_daily_breakdowns WHERE day = $1::date AND dimension = $2::text`,
          [dayText, dimension],
        );
        await client.query(
          `
            INSERT INTO click_daily_breakdowns
              (link_id, user_id, day, dimension, value, count)
            SELECT link_id, user_id, $1::date, $2::text, ${column}, count(*)::int
            FROM click_events
            WHERE clicked_at >= ($1::date::timestamp AT TIME ZONE 'UTC')
              AND clicked_at < ($3::date::timestamp AT TIME ZONE 'UTC')
              AND ${column} IS NOT NULL
            GROUP BY link_id, user_id, ${column}
            ON CONFLICT (link_id, day, dimension, value)
            DO UPDATE SET count = EXCLUDED.count
          `,
          [dayText, dimension, nextText],
        );
      }

      rolledUpDays += 1;
    }

    const updateWatermark = options.updateWatermark ?? options.from === undefined;
    if (updateWatermark) {
      await client.query(
        `
          UPDATE job_state
          SET watermark = GREATEST(watermark, $2::date), updated_at = now()
          WHERE name = $1
        `,
        [JOB_NAME, dateOnly(through)],
      );
    }
    await client.query("COMMIT");

    return { days: rolledUpDays, watermark: dateOnly(through) };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function clearHashes(client: pg.Client): Promise<number> {
  const result = await client.query(
    `
      UPDATE click_events
      SET visitor_hash = NULL
      WHERE visitor_hash IS NOT NULL
        AND clicked_at < now() - interval '24 hours'
    `,
  );
  return result.rowCount ?? 0;
}

async function purgeRawEvents(
  client: pg.Client,
  watermark: string,
): Promise<{ users: number; events: number }> {
  const users = await client.query<{ id: string; plan: string }>(
    `SELECT id::text AS id, plan::text AS plan FROM users WHERE deleted_at IS NULL`,
  );

  let purgedEvents = 0;
  for (const user of users.rows) {
    const retentionDays = entitlementsFor(user.plan as Plan).rawEventRetentionDays;

    for (;;) {
      const result = await client.query(
        `
          DELETE FROM click_events
          WHERE ctid IN (
            SELECT ctid
            FROM click_events
            WHERE user_id = $1::uuid
              AND clicked_at < LEAST(
                now() - make_interval(days => $2::int),
                (($3::date + 1)::timestamp AT TIME ZONE 'UTC')
              )
            LIMIT ${BATCH_SIZE}
          )
        `,
        [user.id, retentionDays, watermark],
      );

      const deleted = result.rowCount ?? 0;
      purgedEvents += deleted;
      if (deleted < BATCH_SIZE) break;
    }
  }

  return { users: users.rows.length, events: purgedEvents };
}

interface PruneCounts {
  tokens: number;
  sessions: number;
  links: number;
  categories: number;
  users: number;
}

async function prune(client: pg.Client): Promise<PruneCounts> {
  const tokens = await client.query(
    `
      DELETE FROM verification_tokens
      WHERE expires_at < now()
        OR (used_at IS NOT NULL AND used_at < now() - interval '30 days')
    `,
  );

  const sessions = await client.query(
    `DELETE FROM sessions WHERE expire < now()`,
  );

  // Category deletion is NoAction on the composite link FK, so detach any
  // remaining links before hard-deleting a long-soft-deleted category.
  await client.query(
    `
      UPDATE links
      SET category_id = NULL
      WHERE category_id IN (
        SELECT id
        FROM categories
        WHERE deleted_at IS NOT NULL
          AND deleted_at < now() - interval '30 days'
      )
    `,
  );

  const links = await client.query(
    `DELETE FROM links WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days'`,
  );
  const categories = await client.query(
    `DELETE FROM categories WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days'`,
  );

  const expiredUsers = await client.query<{ id: string }>(
    `
      SELECT id::text AS id
      FROM users
      WHERE deletion_scheduled_for IS NOT NULL
        AND deletion_scheduled_for <= now()
    `,
  );

  for (const user of expiredUsers.rows) {
    await client.query("BEGIN");
    try {
      await client.query(
        `UPDATE users SET status = 'deleted', updated_at = now() WHERE id = $1::uuid`,
        [user.id],
      );
      await client.query(
        `DELETE FROM sessions WHERE sess->>'userId' = $1`,
        [user.id],
      );
      await client.query(`DELETE FROM users WHERE id = $1::uuid`, [user.id]);
      await client.query("COMMIT");
      audit({ action: "account.purged", targetUserId: user.id });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }

  return {
    tokens: tokens.rowCount ?? 0,
    sessions: sessions.rowCount ?? 0,
    links: links.rowCount ?? 0,
    categories: categories.rowCount ?? 0,
    users: expiredUsers.rows.length,
  };
}

async function main(): Promise<void> {
  // This job is intentionally independent of the API env schema. It only needs
  // a direct (non-pooled) database connection, so CI does not have to expose
  // signing, proxy, or analytics secrets to the workflow.
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DIRECT_URL or DATABASE_URL is required for the analytics job.");
  }

  const client = new pg.Client({
    connectionString,
    application_name: "linkhub-analytics-nightly",
  });
  await client.connect();

  let locked = false;
  try {
    const lock = await client.query<{ locked: boolean }>(
      `SELECT pg_try_advisory_lock(hashtext($1)::bigint) AS locked`,
      [LOCK_NAME],
    );
    locked = lock.rows[0]?.locked === true;
    if (!locked) {
      logger.info("analytics nightly job is already running; skipping");
      return;
    }

    const rolledUp = await rollup(client, { now: new Date() });
    const hashesCleared = await clearHashes(client);
    const raw = await purgeRawEvents(client, rolledUp.watermark);
    const pruned = await prune(client);

    logger.info(
      {
        rolledUpDays: rolledUp.days,
        watermark: rolledUp.watermark,
        hashesCleared,
        rawEventsPurged: raw.events,
        usersScanned: raw.users,
        pruned,
      },
      "analytics nightly job finished",
    );
  } finally {
    if (locked) {
      await client
        .query(`SELECT pg_advisory_unlock(hashtext($1)::bigint)`, [LOCK_NAME])
        .catch((error: unknown) => {
          logger.error({ err: error }, "failed to release the analytics job lock");
        });
    }
    await client.end();
  }
}

const entrypoint = process.argv[1];
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
  main()
    .then(() => {
      process.exit(0);
    })
    .catch((error: unknown) => {
      logger.error({ err: error }, "analytics nightly job failed");
      process.exit(1);
    });
}
