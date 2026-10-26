"use client";

import { useEffect, useState } from "react";
import type { AnalyticsOverview, DailyPoint, Link } from "@linkhub/shared";
import { api, toApiRange } from "./api-client";

export type RangeDays = 7 | 30 | 90;

export const RANGE_OPTIONS: Array<{ value: RangeDays; label: string }> = [
  { value: 7, label: "Last 7 days" },
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 90 days" },
];

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

export function sumSeries(points: DailyPoint[] | undefined): number {
  if (!points) return 0;
  return points.reduce((total, point) => total + point.count, 0);
}

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Loads the aggregate analytics payload for a range. A link filter reuses the
 * same endpoint the dashboard uses; the API caps `topLinks` at five but returns
 * complete totals, series and breakdowns for the selected scope.
 */
export function useAnalytics(
  rangeDays: RangeDays,
  linkId?: string,
  enabled = true,
): AsyncState<AnalyticsOverview> {
  const [state, setState] = useState<AsyncState<AnalyticsOverview>>({
    data: null,
    loading: enabled,
    error: null,
  });

  useEffect(() => {
    if (!enabled) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    let cancelled = false;
    setState({ data: null, loading: true, error: null });

    api.analytics
      .overview(toApiRange(rangeDays), linkId)
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          data: null,
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : "Analytics could not be loaded. Try again.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [rangeDays, linkId, enabled]);

  return state;
}

interface SeriesCacheEntry {
  at: number;
  data?: DailyPoint[];
  promise?: Promise<DailyPoint[]>;
}

const SERIES_TTL_MS = 60_000;
const seriesCache = new Map<string, SeriesCacheEntry>();

/** Drop cached per-link series after a link/category mutation or a new click. */
export function invalidateAnalyticsCache(): void {
  seriesCache.clear();
}

function loadLinkSeries(linkId: string, rangeDays: RangeDays): Promise<DailyPoint[]> {
  const key = `${linkId}:${rangeDays}`;
  const cached = seriesCache.get(key);
  if (cached?.data && Date.now() - cached.at < SERIES_TTL_MS) {
    return Promise.resolve(cached.data);
  }
  if (cached?.promise) return cached.promise;

  const promise = api.analytics
    .timeseries(toApiRange(rangeDays), linkId)
    .then((response) => {
      seriesCache.set(key, { at: Date.now(), data: response.series });
      return response.series;
    })
    .catch((error: unknown) => {
      seriesCache.delete(key);
      throw error;
    });

  seriesCache.set(key, { at: Date.now(), promise });
  return promise;
}

/**
 * Loads the daily series for every link so tables can show per-link totals and
 * sparklines. Requests are cached for a minute and deduped by link id + range.
 * The API has no bulk per-link endpoint, so the browser's connection pool
 * naturally caps concurrency while the cache prevents repeat work across pages.
 */
export function useLinkSeries(
  links: Link[],
  rangeDays: RangeDays,
): { seriesById: Map<string, DailyPoint[]>; loading: boolean } {
  const [seriesById, setSeriesById] = useState<Map<string, DailyPoint[]>>(
    () => new Map(),
  );
  const [loading, setLoading] = useState(links.length > 0);
  const signature = links.map((link) => link.id).join(",");

  useEffect(() => {
    let cancelled = false;
    const ids = signature ? signature.split(",") : [];

    if (ids.length === 0) {
      setSeriesById(new Map());
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.all(
      ids.map((id) =>
        loadLinkSeries(id, rangeDays)
          .then((series) => [id, series] as const)
          .catch(() => null),
      ),
    ).then((entries) => {
      if (cancelled) return;
      const next = new Map<string, DailyPoint[]>();
      for (const entry of entries) {
        if (entry) next.set(entry[0], entry[1]);
      }
      setSeriesById(next);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [signature, rangeDays]);

  return { seriesById, loading };
}
