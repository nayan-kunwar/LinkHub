import type { AnalyticsOverview, BreakdownSlice, DailyPoint } from "@linkhub/shared";
import type { MockLink, MockState } from "./mock-data";

export type RangeDays = 7 | 30 | 90;

export const RANGE_OPTIONS: Array<{ value: RangeDays; label: string }> = [
  { value: 7, label: "Last 7 days" },
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 90 days" },
];

const SERIES_DAYS = 365;

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  let value = seed;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Builds a stable click history for preview data. The shape mirrors what the
 * rollup-backed API will return, but is derived from the link id + seed weight
 * so numbers never jump between renders.
 */
export function buildLinkSeries(link: MockLink, today = new Date()): DailyPoint[] {
  const end = startOfUtcDay(today);
  const random = mulberry32(hashString(`${link.id}:${link.baseWeight}`));
  const points: DailyPoint[] = [];

  for (let index = 0; index < SERIES_DAYS; index += 1) {
    const date = new Date(end);
    date.setUTCDate(date.getUTCDate() - (SERIES_DAYS - 1 - index));
    const weekday = date.getUTCDay();
    const weekendFactor = weekday === 0 || weekday === 6 ? 0.7 : 1.1;
    const trend = 0.75 + (0.5 * index) / SERIES_DAYS;
    let count = (link.baseWeight / 30) * weekendFactor * trend * (0.45 + 1.1 * random());
    if (random() < 0.04) count *= 2.4;
    if (!link.isActive && index > SERIES_DAYS - 45) count = 0;
    points.push({ date: isoDay(date), count: Math.max(0, Math.round(count)) });
  }

  return points;
}

function sum(points: DailyPoint[]): number {
  return points.reduce((total, point) => total + point.count, 0);
}

function sliceRange(series: DailyPoint[], days: number, offset = 0): DailyPoint[] {
  const end = SERIES_DAYS - offset * days;
  const start = Math.max(0, end - days);
  return series.slice(start, end);
}

function largestRemainder(total: number, shares: Array<[string, number]>): Array<[string, number]> {
  const raw = shares.map(([key, share]) => [key, total * share] as const);
  const floored = raw.map(([key, value]) => [key, Math.floor(value), value - Math.floor(value)] as const);
  let remaining = total - floored.reduce((sumValue, [, value]) => sumValue + value, 0);
  const ordered = [...floored].sort((a, b) => b[2] - a[2]);
  const output = new Map(floored.map(([key, value]) => [key, value]));
  for (const [key] of ordered) {
    if (remaining <= 0) break;
    output.set(key, (output.get(key) ?? 0) + 1);
    remaining -= 1;
  }
  return floored.map(([key]) => [key, output.get(key) ?? 0]);
}

function toSlices(
  total: number,
  definitions: Array<{ key: string; label: string; share: number; color: string }>,
): BreakdownSlice[] {
  const split = new Map(largestRemainder(total, definitions.map((item) => [item.key, item.share])));
  return definitions.map((item) => {
    const count = split.get(item.key) ?? 0;
    return {
      key: item.key,
      label: item.label,
      count,
      share: total === 0 ? 0 : count / total,
      color: item.color,
    };
  });
}

export const REFERRERS = [
  { key: "direct", label: "Direct", share: 0.37, color: "#6d28d9" },
  { key: "google.com", label: "google.com", share: 0.21, color: "#a78bfa" },
  { key: "linkedin.com", label: "linkedin.com", share: 0.15, color: "#2563eb" },
  { key: "x.com", label: "x.com", share: 0.11, color: "#18181b" },
  { key: "github.com", label: "github.com", share: 0.1, color: "#059669" },
  { key: "medium.com", label: "medium.com", share: 0.06, color: "#f59e0b" },
] as const;

export const DEVICES = [
  { key: "mobile", label: "Mobile", share: 0.64, color: "#7c3aed" },
  { key: "desktop", label: "Desktop", share: 0.32, color: "#38bdf8" },
  { key: "tablet", label: "Tablet", share: 0.04, color: "#c4b5fd" },
] as const;

export const COUNTRIES = [
  { key: "IN", label: "India", share: 0.62, color: "#7c3aed" },
  { key: "US", label: "United States", share: 0.14, color: "#a78bfa" },
  { key: "GB", label: "United Kingdom", share: 0.06, color: "#2563eb" },
  { key: "DE", label: "Germany", share: 0.04, color: "#059669" },
  { key: "CA", label: "Canada", share: 0.03, color: "#f59e0b" },
  { key: "OTHER", label: "Other", share: 0.11, color: "#cbd5e1" },
] as const;

export function getAnalytics(state: MockState, rangeDays: RangeDays, today = new Date()): AnalyticsOverview {
  const perLink = new Map<string, DailyPoint[]>();
  for (const link of state.links) perLink.set(link.id, buildLinkSeries(link, today));

  const aggregate = (days: number, offset = 0): DailyPoint[] => {
    const totals = new Map<string, number>();
    for (const link of state.links) {
      for (const point of sliceRange(perLink.get(link.id) ?? [], days, offset)) {
        totals.set(point.date, (totals.get(point.date) ?? 0) + point.count);
      }
    }
    return Array.from(totals.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));
  };

  const series = aggregate(rangeDays);
  const total = sum(series);
  const previousTotal = sum(aggregate(rangeDays, 1));
  const change = previousTotal === 0 ? null : Math.round(((total - previousTotal) / previousTotal) * 100);

  const peakDay = series.reduce<DailyPoint | null>(
    (peak, point) => (!peak || point.count > peak.count ? point : peak),
    null,
  );

  const linkTotals = state.links
    .map((link) => ({
      linkId: link.id,
      title: link.title,
      count: sum(sliceRange(perLink.get(link.id) ?? [], rangeDays)),
    }))
    .sort((a, b) => b.count - a.count);

  const topLinks = linkTotals.slice(0, 5).map((item) => ({
    ...item,
    share: total === 0 ? 0 : item.count / total,
  }));

  const referrers = toSlices(total, [...REFERRERS]);
  const devices = toSlices(total, [...DEVICES]);
  const countries = toSlices(total, [...COUNTRIES]);

  const insights: string[] = [];
  if (change === null) {
    insights.push("There is no prior period to compare yet. Keep sharing your page to build a baseline.");
  } else if (change === 0) {
    insights.push(`Recorded clicks are level with the previous ${rangeDays} days (${previousTotal.toLocaleString("en-IN")} → ${total.toLocaleString("en-IN")}).`);
  } else {
    insights.push(
      `Recorded clicks are ${change > 0 ? "up" : "down"} ${Math.abs(change)}% compared with the previous ${rangeDays} days (${previousTotal.toLocaleString("en-IN")} → ${total.toLocaleString("en-IN")}).`,
    );
  }
  if (topLinks[0]?.count) {
    insights.push(`${topLinks[0].title} is your top link with ${Math.round(topLinks[0].share * 100)}% of clicks.`);
  }
  if (referrers[0]?.count) {
    insights.push(`${referrers[0].label === "Direct" ? "Direct visits bring" : `${referrers[0].label} brings`} the most traffic (${Math.round(referrers[0].share * 100)}%).`);
  }
  if (countries[0]?.count) {
    insights.push(`Most visitors are in ${countries[0].label} (${Math.round(countries[0].share * 100)}%).`);
  }
  if (peakDay?.count) {
    const label = new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(new Date(`${peakDay.date}T00:00:00.000Z`));
    insights.push(`Your best day was ${label}, with ${peakDay.count.toLocaleString("en-IN")} recorded clicks.`);
  }

  return {
    rangeDays,
    total,
    previousTotal,
    change,
    averagePerDay: total / rangeDays,
    activeLinks: state.links.filter((link) => link.isActive).length,
    totalLinks: state.links.length,
    peakDay,
    series,
    topLinks,
    referrers,
    devices,
    countries,
    insights,
  };
}

export function getLinkClickCount(state: MockState, link: MockLink, rangeDays: RangeDays, today = new Date()): number {
  return sum(sliceRange(buildLinkSeries(link, today), rangeDays));
}

export function getDailyRows(state: MockState, days = 365, today = new Date()) {
  const rows: Array<{ linkId: string; linkTitle: string; date: string; count: number }> = [];
  for (const link of state.links) {
    for (const point of sliceRange(buildLinkSeries(link, today), days)) {
      rows.push({ linkId: link.id, linkTitle: link.title, date: point.date, count: point.count });
    }
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.linkTitle.localeCompare(b.linkTitle));
}

export function formatSeriesLabel(date: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

export function formatSeriesTick(date: string): string {
  return formatSeriesLabel(date);
}
