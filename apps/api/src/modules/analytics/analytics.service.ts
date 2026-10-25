import { Prisma, type Plan } from "@prisma/client";
import type {
  AnalyticsOverview,
  BreakdownSlice,
  DailyPoint,
} from "@linkhub/shared";
import { prisma } from "../../lib/db";
import { linkDto } from "../../lib/dto";
import { entitlementsFor } from "../../lib/entitlements";
import { fail } from "../../lib/errors";
import { scoped } from "../../lib/tenant";

export type RangeKey = "7d" | "30d" | "90d" | "365d";
export type BreakdownDimension = "country" | "device" | "referrer";

const RANGE_DAYS: Record<RangeKey, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "365d": 365,
};

const SLICE_COLORS = [
  "#6d28d9",
  "#a78bfa",
  "#2563eb",
  "#059669",
  "#f59e0b",
  "#db2777",
  "#64748b",
];

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

function startOfUtcDay(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dayKey(value: unknown): string {
  return value instanceof Date ? isoDay(value) : String(value).slice(0, 10);
}

function minDate(left: Date, right: Date): Date {
  return left.getTime() <= right.getTime() ? left : right;
}

function resolveDays(range: RangeKey, plan: Plan): number {
  const requested = RANGE_DAYS[range];
  const cap = entitlementsFor(plan).analyticsHistoryDays;
  return Math.min(requested, cap);
}

interface Period {
  start: Date;
  endExclusive: Date;
  days: number;
}

function periodFor(days: number, offset = 0): Period {
  const today = startOfUtcDay();
  const endExclusive = addDays(today, 1 - offset * days);
  return { start: addDays(endExclusive, -days), endExclusive, days };
}

interface Window {
  statsStart: Date;
  statsEnd: Date;
  hasStats: boolean;
  rawStart: Date;
  hasRaw: boolean;
  endExclusive: Date;
}

function windowFor(period: Period, watermark: Date | null): Window {
  const lastDay = addDays(period.endExclusive, -1);
  const statsEnd = watermark ? minDate(watermark, lastDay) : addDays(period.start, -1);
  const hasStats = statsEnd.getTime() >= period.start.getTime();
  const rawStart =
    watermark && watermark.getTime() >= period.start.getTime()
      ? addDays(watermark, 1)
      : period.start;
  return {
    statsStart: period.start,
    statsEnd,
    hasStats,
    rawStart,
    hasRaw: rawStart.getTime() < period.endExclusive.getTime(),
    endExclusive: period.endExclusive,
  };
}

async function watermarkFor(): Promise<Date | null> {
  const state = await prisma.jobState.findUnique({
    where: { name: "analytics_rollup" },
    select: { watermark: true },
  });
  return state?.watermark ?? null;
}

async function sumStats(
  userId: string,
  linkId: string | undefined,
  window: Window,
): Promise<number> {
  if (!window.hasStats) return 0;
  const result = await prisma.clickDailyStat.aggregate({
    where: {
      userId,
      ...(linkId ? { linkId } : {}),
      day: { gte: window.statsStart, lte: window.statsEnd },
    },
    _sum: { count: true },
  });
  return result._sum.count ?? 0;
}

async function countRaw(
  userId: string,
  linkId: string | undefined,
  window: Window,
): Promise<number> {
  if (!window.hasRaw) return 0;
  return prisma.clickEvent.count({
    where: {
      userId,
      ...(linkId ? { linkId } : {}),
      clickedAt: { gte: window.rawStart, lt: window.endExclusive },
    },
  });
}

async function totalFor(
  userId: string,
  linkId: string | undefined,
  window: Window,
): Promise<number> {
  const [rolled, raw] = await Promise.all([
    sumStats(userId, linkId, window),
    countRaw(userId, linkId, window),
  ]);
  return rolled + raw;
}

async function seriesFor(
  userId: string,
  linkId: string | undefined,
  period: Period,
  window: Window,
): Promise<DailyPoint[]> {
  const days = new Map<string, number>();
  for (let index = 0; index < period.days; index += 1) {
    days.set(isoDay(addDays(period.start, index)), 0);
  }

  if (window.hasStats) {
    const rows = await prisma.clickDailyStat.groupBy({
      by: ["day"],
      where: {
        userId,
        ...(linkId ? { linkId } : {}),
        day: { gte: window.statsStart, lte: window.statsEnd },
      },
      _sum: { count: true },
    });
    for (const row of rows) {
      const key = isoDay(row.day);
      days.set(key, (days.get(key) ?? 0) + (row._sum.count ?? 0));
    }
  }

  if (window.hasRaw) {
    const linkFilter = linkId
      ? Prisma.sql`AND link_id = ${linkId}::uuid`
      : Prisma.empty;
    const rows = await prisma.$queryRaw<Array<{ day: unknown; count: number }>>(
      Prisma.sql`
        SELECT (clicked_at AT TIME ZONE 'UTC')::date AS day, count(*)::int AS count
        FROM click_events
        WHERE user_id = ${userId}::uuid
          AND clicked_at >= ${window.rawStart}
          AND clicked_at < ${window.endExclusive}
          ${linkFilter}
        GROUP BY 1
      `,
    );
    for (const row of rows) {
      const key = dayKey(row.day);
      days.set(key, (days.get(key) ?? 0) + Number(row.count));
    }
  }

  return Array.from(days.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, count]) => ({ date, count }));
}

async function breakdownFor(
  userId: string,
  linkId: string | undefined,
  window: Window,
  dimension: BreakdownDimension,
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();

  if (window.hasStats) {
    const rows = await prisma.clickDailyBreakdown.groupBy({
      by: ["value"],
      where: {
        userId,
        ...(linkId ? { linkId } : {}),
        dimension,
        day: { gte: window.statsStart, lte: window.statsEnd },
      },
      _sum: { count: true },
    });
    for (const row of rows) {
      counts.set(row.value, (counts.get(row.value) ?? 0) + (row._sum.count ?? 0));
    }
  }

  if (window.hasRaw) {
    const column =
      dimension === "country"
        ? Prisma.raw("country_code")
        : dimension === "device"
          ? Prisma.raw("device_type")
          : Prisma.raw("referrer_host");
    const linkFilter = linkId
      ? Prisma.sql`AND link_id = ${linkId}::uuid`
      : Prisma.empty;
    const rows = await prisma.$queryRaw<Array<{ value: string; count: number }>>(
      Prisma.sql`
        SELECT ${column} AS value, count(*)::int AS count
        FROM click_events
        WHERE user_id = ${userId}::uuid
          AND clicked_at >= ${window.rawStart}
          AND clicked_at < ${window.endExclusive}
          ${linkFilter}
          AND ${column} IS NOT NULL
        GROUP BY ${column}
      `,
    );
    for (const row of rows) {
      counts.set(row.value, (counts.get(row.value) ?? 0) + Number(row.count));
    }
  }

  return counts;
}

function labelFor(dimension: BreakdownDimension, key: string): string {
  if (dimension === "country") {
    if (key === "OTHER") return "Other";
    try {
      return regionNames.of(key) ?? key;
    } catch {
      return key;
    }
  }
  if (dimension === "device") {
    if (key === "other") return "Other";
    return key.charAt(0).toUpperCase() + key.slice(1);
  }
  return key === "direct" ? "Direct" : key;
}

function buildSlices(
  counts: Map<string, number>,
  total: number,
  dimension: BreakdownDimension,
): BreakdownSlice[] {
  const sorted = Array.from(counts.entries())
    .filter(([, count]) => count > 0)
    .sort((left, right) => right[1] - left[1]);

  const top = sorted.slice(0, 5);
  const topTotal = top.reduce((sum, [, count]) => sum + count, 0);
  const knownTotal = sorted.reduce((sum, [, count]) => sum + count, 0);
  const omittedKnown = knownTotal - topTotal;
  const missing = Math.max(0, total - knownTotal);

  const slices: Array<[string, string, number]> = top.map(([key, count]) => [
    key,
    labelFor(dimension, key),
    count,
  ]);

  if (dimension === "referrer") {
    if (omittedKnown > 0) slices.push(["other", "Other", omittedKnown]);
    if (missing > 0) slices.push(["direct", "Direct", missing]);
  } else {
    const remainder = omittedKnown + missing;
    if (remainder > 0) {
      slices.push([
        dimension === "country" ? "OTHER" : "other",
        "Other",
        remainder,
      ]);
    }
  }

  return slices.map(([key, label, count], index) => ({
    key,
    label,
    count,
    share: total === 0 ? 0 : count / total,
    color: SLICE_COLORS[index % SLICE_COLORS.length],
  }));
}

async function linkCounts(
  userId: string,
  linkId: string | undefined,
  window: Window,
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();

  if (window.hasStats) {
    const rows = await prisma.clickDailyStat.groupBy({
      by: ["linkId"],
      where: {
        userId,
        ...(linkId ? { linkId } : {}),
        day: { gte: window.statsStart, lte: window.statsEnd },
      },
      _sum: { count: true },
    });
    for (const row of rows) {
      counts.set(row.linkId, (counts.get(row.linkId) ?? 0) + (row._sum.count ?? 0));
    }
  }

  if (window.hasRaw) {
    const rows = await prisma.clickEvent.groupBy({
      by: ["linkId"],
      where: {
        userId,
        ...(linkId ? { linkId } : {}),
        clickedAt: { gte: window.rawStart, lt: window.endExclusive },
      },
      _count: { _all: true },
    });
    for (const row of rows) {
      counts.set(row.linkId, (counts.get(row.linkId) ?? 0) + row._count._all);
    }
  }

  return counts;
}

function insightsFor(
  days: number,
  total: number,
  previousTotal: number,
  change: number | null,
  referrers: BreakdownSlice[],
  countries: BreakdownSlice[],
  activeLinks: number,
): string[] {
  const insights: string[] = [];

  if (change === null) {
    insights.push(
      "There is no prior period to compare yet. Keep sharing your page to build a baseline.",
    );
  } else if (change === 0) {
    insights.push(
      `Recorded clicks are level with the previous ${days} days (${previousTotal.toLocaleString("en-IN")} → ${total.toLocaleString("en-IN")}).`,
    );
  } else {
    insights.push(
      `Clicks are ${change > 0 ? "up" : "down"} ${Math.abs(change)}% compared with the previous ${days} days (${previousTotal.toLocaleString("en-IN")} → ${total.toLocaleString("en-IN")}).`,
    );
  }

  const topReferrer = referrers.find((slice) => slice.key !== "direct");
  if (topReferrer && topReferrer.count > 0) {
    insights.push(
      `${topReferrer.label} is your top referrer with ${topReferrer.count.toLocaleString("en-IN")} click${topReferrer.count === 1 ? "" : "s"}.`,
    );
  }

  const topCountry = countries.find((slice) => slice.key !== "OTHER");
  if (topCountry && topCountry.count > 0) {
    insights.push(
      `${topCountry.label} leads by country with ${Math.round(topCountry.share * 100)}% of clicks.`,
    );
  }

  if (activeLinks === 0) {
    insights.push("Activate at least one link to start collecting clicks.");
  }

  return insights;
}

export async function getOverview(
  userId: string,
  plan: Plan,
  range: RangeKey,
  linkId?: string,
): Promise<AnalyticsOverview> {
  if (linkId) {
    const link = await scoped(userId).links.get(linkId);
    if (!link) throw fail.notFound();
  }

  const days = resolveDays(range, plan);
  const current = periodFor(days);
  const previous = periodFor(days, 1);
  const watermark = await watermarkFor();
  const currentWindow = windowFor(current, watermark);
  const previousWindow = windowFor(previous, watermark);

  const [
    total,
    previousTotal,
    series,
    referrerCounts,
    deviceCounts,
    countryCounts,
    countsByLink,
    totalLinks,
    activeLinks,
    links,
  ] = await Promise.all([
    totalFor(userId, linkId, currentWindow),
    totalFor(userId, linkId, previousWindow),
    seriesFor(userId, linkId, current, currentWindow),
    breakdownFor(userId, linkId, currentWindow, "referrer"),
    breakdownFor(userId, linkId, currentWindow, "device"),
    breakdownFor(userId, linkId, currentWindow, "country"),
    linkCounts(userId, linkId, currentWindow),
    prisma.link.count({ where: { userId, deletedAt: null } }),
    prisma.link.count({ where: { userId, deletedAt: null, isActive: true } }),
    prisma.link.findMany({
      where: { userId, deletedAt: null, ...(linkId ? { id: linkId } : {}) },
      select: { id: true, title: true },
    }),
  ]);

  const titleById = new Map(links.map((link) => [link.id, link.title]));
  const topLinks = Array.from(countsByLink.entries())
    .map(([id, count]) => ({
      linkId: id,
      title: titleById.get(id) ?? "Deleted link",
      count,
    }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 5)
    .map((item) => ({
      ...item,
      share: total === 0 ? 0 : item.count / total,
    }));

  const referrers = buildSlices(referrerCounts, total, "referrer");
  const devices = buildSlices(deviceCounts, total, "device");
  const countries = buildSlices(countryCounts, total, "country");
  const change =
    previousTotal === 0
      ? null
      : Math.round(((total - previousTotal) / previousTotal) * 100);

  const peakDay = series.reduce<DailyPoint | null>(
    (peak, point) => (!peak || point.count > peak.count ? point : peak),
    null,
  );

  return {
    rangeDays: days,
    total,
    previousTotal,
    change,
    averagePerDay: days === 0 ? 0 : Math.round((total / days) * 10) / 10,
    activeLinks,
    totalLinks,
    peakDay,
    series,
    topLinks,
    referrers,
    devices,
    countries,
    insights: insightsFor(
      days,
      total,
      previousTotal,
      change,
      referrers,
      countries,
      activeLinks,
    ),
  };
}

export async function getTimeseries(
  userId: string,
  plan: Plan,
  range: RangeKey,
  linkId?: string,
) {
  if (linkId) {
    const link = await scoped(userId).links.get(linkId);
    if (!link) throw fail.notFound();
  }
  const days = resolveDays(range, plan);
  const period = periodFor(days);
  const watermark = await watermarkFor();
  return {
    rangeDays: days,
    series: await seriesFor(userId, linkId, period, windowFor(period, watermark)),
  };
}

export async function getBreakdown(
  userId: string,
  plan: Plan,
  range: RangeKey,
  dimension: BreakdownDimension,
  linkId?: string,
) {
  if (linkId) {
    const link = await scoped(userId).links.get(linkId);
    if (!link) throw fail.notFound();
  }
  const days = resolveDays(range, plan);
  const period = periodFor(days);
  const watermark = await watermarkFor();
  const window = windowFor(period, watermark);
  const [total, counts] = await Promise.all([
    totalFor(userId, linkId, window),
    breakdownFor(userId, linkId, window, dimension),
  ]);
  return {
    dimension,
    rangeDays: days,
    total,
    slices: buildSlices(counts, total, dimension),
  };
}

export async function getLinkAnalytics(
  userId: string,
  plan: Plan,
  linkId: string,
  range: RangeKey,
) {
  const link = await scoped(userId).links.get(linkId);
  if (!link) throw fail.notFound();
  const overview = await getOverview(userId, plan, range, linkId);
  return {
    link: linkDto(link),
    ...overview,
  };
}

export interface ExportHistory {
  linkTotals: Map<string, number>;
  daily: Array<{ date: string; linkId: string; count: number }>;
  breakdowns: Array<{
    date: string;
    linkId: string;
    dimension: BreakdownDimension;
    value: string;
    count: number;
  }>;
}

/** Shared by the export module; mirrors the dashboard's watermark split. */
export async function getExportHistory(
  userId: string,
  days: number,
): Promise<ExportHistory> {
  const today = startOfUtcDay();
  const period: Period = {
    start: addDays(today, -(days - 1)),
    endExclusive: addDays(today, 1),
    days,
  };
  const watermark = await watermarkFor();
  const window = windowFor(period, watermark);

  const linkTotals = await linkCounts(userId, undefined, window);

  const daily = new Map<string, { date: string; linkId: string; count: number }>();
  if (window.hasStats) {
    const rows = await prisma.clickDailyStat.groupBy({
      by: ["day", "linkId"],
      where: {
        userId,
        day: { gte: window.statsStart, lte: window.statsEnd },
      },
      _sum: { count: true },
    });
    for (const row of rows) {
      const date = isoDay(row.day);
      const key = `${date}|${row.linkId}`;
      daily.set(key, {
        date,
        linkId: row.linkId,
        count: row._sum.count ?? 0,
      });
    }
  }
  if (window.hasRaw) {
    const rows = await prisma.$queryRaw<
      Array<{ day: unknown; link_id: string; count: number }>
    >(Prisma.sql`
      SELECT (clicked_at AT TIME ZONE 'UTC')::date AS day, link_id, count(*)::int AS count
      FROM click_events
      WHERE user_id = ${userId}::uuid
        AND clicked_at >= ${window.rawStart}
        AND clicked_at < ${window.endExclusive}
      GROUP BY 1, 2
    `);
    for (const row of rows) {
      const date = dayKey(row.day);
      const key = `${date}|${row.link_id}`;
      const existing = daily.get(key);
      daily.set(key, {
        date,
        linkId: row.link_id,
        count: (existing?.count ?? 0) + Number(row.count),
      });
    }
  }

  const breakdowns = new Map<
    string,
    {
      date: string;
      linkId: string;
      dimension: BreakdownDimension;
      value: string;
      count: number;
    }
  >();
  if (window.hasStats) {
    const rows = await prisma.clickDailyBreakdown.groupBy({
      by: ["day", "linkId", "dimension", "value"],
      where: {
        userId,
        day: { gte: window.statsStart, lte: window.statsEnd },
      },
      _sum: { count: true },
    });
    for (const row of rows) {
      const date = isoDay(row.day);
      const dimension = row.dimension as BreakdownDimension;
      const key = `${date}|${row.linkId}|${dimension}|${row.value}`;
      breakdowns.set(key, {
        date,
        linkId: row.linkId,
        dimension,
        value: row.value,
        count: row._sum.count ?? 0,
      });
    }
  }
  if (window.hasRaw) {
    const rows = await prisma.$queryRaw<
      Array<{
        day: unknown;
        link_id: string;
        dimension: string;
        value: string;
        count: number;
      }>
    >(Prisma.sql`
      SELECT (clicked_at AT TIME ZONE 'UTC')::date AS day, link_id, 'country' AS dimension, country_code AS value, count(*)::int AS count
      FROM click_events
      WHERE user_id = ${userId}::uuid AND clicked_at >= ${window.rawStart} AND clicked_at < ${window.endExclusive} AND country_code IS NOT NULL
      GROUP BY 1, 2, 3, 4
      UNION ALL
      SELECT (clicked_at AT TIME ZONE 'UTC')::date AS day, link_id, 'device' AS dimension, device_type AS value, count(*)::int AS count
      FROM click_events
      WHERE user_id = ${userId}::uuid AND clicked_at >= ${window.rawStart} AND clicked_at < ${window.endExclusive} AND device_type IS NOT NULL
      GROUP BY 1, 2, 3, 4
      UNION ALL
      SELECT (clicked_at AT TIME ZONE 'UTC')::date AS day, link_id, 'referrer' AS dimension, referrer_host AS value, count(*)::int AS count
      FROM click_events
      WHERE user_id = ${userId}::uuid AND clicked_at >= ${window.rawStart} AND clicked_at < ${window.endExclusive} AND referrer_host IS NOT NULL
      GROUP BY 1, 2, 3, 4
    `);
    for (const row of rows) {
      const date = dayKey(row.day);
      const dimension = row.dimension as BreakdownDimension;
      const key = `${date}|${row.link_id}|${dimension}|${row.value}`;
      const existing = breakdowns.get(key);
      breakdowns.set(key, {
        date,
        linkId: row.link_id,
        dimension,
        value: row.value,
        count: (existing?.count ?? 0) + Number(row.count),
      });
    }
  }

  return {
    linkTotals,
    daily: Array.from(daily.values()).sort((left, right) =>
      left.date.localeCompare(right.date) || left.linkId.localeCompare(right.linkId),
    ),
    breakdowns: Array.from(breakdowns.values()).sort((left, right) =>
      left.date.localeCompare(right.date) ||
      left.linkId.localeCompare(right.linkId) ||
      left.dimension.localeCompare(right.dimension) ||
      left.value.localeCompare(right.value),
    ),
  };
}
