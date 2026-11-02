import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { rollup } from "./analytics-nightly";

const describeDb = process.env.RUN_DB_TESTS === "1" ? describe : describe.skip;
const DAY = "2001-02-03";

interface Fixture {
  userId: string;
  linkId: string;
}

async function createFixture(client: pg.Client): Promise<Fixture> {
  const userId = randomUUID();
  const linkId = randomUUID();
  await client.query(
    `INSERT INTO users (id, email, role, status, plan, updated_at)
     VALUES ($1::uuid, $2, 'user', 'active', 'free', now())`,
    [userId, `rollup-${userId}@test.local`],
  );
  await client.query(
    `INSERT INTO links (id, user_id, title, url, type, updated_at)
     VALUES ($1::uuid, $2::uuid, 'Rollup test', 'https://example.com/', 'link', now())`,
    [linkId, userId],
  );
  return { userId, linkId };
}

async function addClick(
  client: pg.Client,
  fixture: Fixture,
  hour: number,
  visitorHash: string | null,
): Promise<void> {
  await client.query(
    `INSERT INTO click_events (id, link_id, user_id, clicked_at, visitor_hash)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::timestamptz, $5)`,
    [
      randomUUID(),
      fixture.linkId,
      fixture.userId,
      new Date(`${DAY}T${String(hour).padStart(2, "0")}:00:00.000Z`),
      visitorHash,
    ],
  );
}

async function rollupDay(client: pg.Client): Promise<void> {
  await rollup(client, {
    from: new Date(`${DAY}T00:00:00.000Z`),
    through: new Date(`${DAY}T00:00:00.000Z`),
    updateWatermark: false,
  });
}

async function readStat(client: pg.Client, linkId: string) {
  const result = await client.query<{
    count: number;
    unique_count: number | null;
  }>(
    `SELECT count, unique_count
     FROM click_daily_stats
     WHERE link_id = $1::uuid AND day = $2::date`,
    [linkId, DAY],
  );
  return result.rows[0];
}

describeDb("analytics rollup unique counts", () => {
  const client = new pg.Client({
    connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  });
  const userIds = new Set<string>();

  beforeAll(async () => {
    await client.connect();
  });

  afterEach(async () => {
    const ids = Array.from(userIds);
    userIds.clear();
    if (ids.length > 0) {
      await client.query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [ids]);
    }
  });

  afterAll(async () => {
    await client.end();
  });

  async function fixture(): Promise<Fixture> {
    const created = await createFixture(client);
    userIds.add(created.userId);
    return created;
  }

  it("writes clicks and distinct visitor hashes on first rollup", async () => {
    const created = await fixture();
    await addClick(client, created, 1, "visitor-a");
    await addClick(client, created, 2, "visitor-a");
    await addClick(client, created, 3, "visitor-b");

    await rollupDay(client);

    await expect(readStat(client, created.linkId)).resolves.toEqual({
      count: 3,
      unique_count: 2,
    });
  });

  it("updates the click count but never overwrites uniques after partial hash clearing", async () => {
    const created = await fixture();
    await addClick(client, created, 1, "visitor-a");
    await addClick(client, created, 2, "visitor-a");
    await addClick(client, created, 3, "visitor-b");

    await rollupDay(client);
    await expect(readStat(client, created.linkId)).resolves.toEqual({
      count: 3,
      unique_count: 2,
    });

    // Simulate the nightly hash purge and a late click arriving during the
    // two-day re-cover window.
    await client.query(
      `UPDATE click_events
       SET visitor_hash = NULL
       WHERE link_id = $1::uuid AND visitor_hash IN ('visitor-a', 'visitor-b')`,
      [created.linkId],
    );
    await addClick(client, created, 4, "visitor-c");

    await rollupDay(client);

    await expect(readStat(client, created.linkId)).resolves.toEqual({
      count: 4,
      unique_count: 2,
    });
  });

  it("does not replace known uniques with zero when every hash is cleared", async () => {
    const created = await fixture();
    await addClick(client, created, 1, "visitor-a");
    await addClick(client, created, 2, "visitor-b");

    await rollupDay(client);
    await expect(readStat(client, created.linkId)).resolves.toEqual({
      count: 2,
      unique_count: 2,
    });

    await client.query(
      `UPDATE click_events SET visitor_hash = NULL WHERE link_id = $1::uuid`,
      [created.linkId],
    );

    await rollupDay(client);

    await expect(readStat(client, created.linkId)).resolves.toEqual({
      count: 2,
      unique_count: 2,
    });
  });

  it("stores null rather than zero when the first rollup has no hashes", async () => {
    const created = await fixture();
    await addClick(client, created, 1, null);
    await addClick(client, created, 2, null);

    await rollupDay(client);

    const stat = await readStat(client, created.linkId);
    expect(stat.count).toBe(2);
    expect(stat.unique_count).toBeNull();
  });
});
