"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { BarChart3, Heart, Link2, PieChart, Star, Users } from "lucide-react";
import { LIMITS } from "@linkhub/shared";
import { CategoryPill } from "@/components/category-pill";
import { ClicksChart } from "@/components/charts/clicks-chart";
import { DonutChart } from "@/components/charts/donut-chart";
import { DashboardFrame } from "@/components/dashboard-frame";
import { DashboardPreview } from "@/components/dashboard-preview";
import { DeltaPill } from "@/components/delta-pill";
import { EmptyState } from "@/components/empty-state";
import { LinkIcon } from "@/components/link-icon";
import { PageHeader } from "@/components/page-header";
import { RangeSelect } from "@/components/range-select";
import { Sparkline } from "@/components/sparkline";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  formatSeriesLabel,
  sumSeries,
  sumUniqueSeries,
  useAnalytics,
  useLinkSeries,
} from "@/lib/analytics";
import { useAppData } from "@/lib/store";
import { useRange } from "@/lib/use-range";
import { formatNumber } from "@/lib/utils";

const CLICKS_TIP =
  "Recorded clicks count taps on your links. Known bots and repeat taps within a few seconds are filtered out, so treat totals as close estimates, not exact visitor counts.";

const UNIQUE_TIP =
  "Unique clicks estimate distinct visitors per link per UTC day using a short-lived, day-scoped hash. The card sums those daily unique clicks for the range. Counting starts with the first nightly rollup after tracking was deployed, so earlier days show —.";

export function AnalyticsFallback() {
  return (
    <DashboardFrame preview={<DashboardPreview />}>
      <PageHeader
        title="Analytics"
        description="Track your link performance and understand where your audience comes from."
      />
      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-5" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, index) => (
          <Card key={index} className="h-28 animate-pulse bg-violet-50/40" />
        ))}
      </div>
      <Card className="h-72 animate-pulse bg-violet-50/30" />
      <p className="sr-only" role="status">
        Loading analytics
      </p>
    </DashboardFrame>
  );
}

export function AnalyticsView() {
  const { state, hydrated } = useAppData();
  const searchParams = useSearchParams();
  const [range, setRange] = useRange(30);
  const linkId = searchParams.get("linkId") ?? searchParams.get("link") ?? "";

  const linkFilter = useMemo(
    () => (linkId ? state.links.find((link) => link.id === linkId) ?? null : null),
    [linkId, state.links],
  );

  const allAnalytics = useAnalytics(range);
  const scopedAnalytics = useAnalytics(range, linkFilter?.id, Boolean(linkFilter));
  const overview = linkFilter ? scopedAnalytics.data : allAnalytics.data;
  const allOverview = linkFilter ? allAnalytics.data : overview;
  const loading = allAnalytics.loading || (linkFilter ? scopedAnalytics.loading : false);

  const { seriesById } = useLinkSeries(linkFilter ? [linkFilter] : state.links, range);

  const categoriesById = useMemo(
    () => new Map(state.categories.map((category) => [category.id, category])),
    [state.categories],
  );

  const allTotal = allOverview?.total ?? 0;
  const uniqueTotal = sumUniqueSeries(overview?.series);
  const linkRows = useMemo(() => {
    const rows = (linkFilter ? [linkFilter] : state.links).map((link) => {
      const series = seriesById.get(link.id) ?? [];
      const count = sumSeries(series);
      return {
        link,
        count,
        uniqueCount: sumUniqueSeries(series),
        series: series.map((point) => point.count),
        share: allTotal === 0 ? 0 : count / allTotal,
      };
    });
    return rows.sort((a, b) => b.count - a.count);
  }, [linkFilter, state.links, seriesById, allTotal]);

  const peakDay = overview?.peakDay ?? null;
  const peakValue = peakDay?.count ?? 0;
  const peakLabel = peakDay ? formatSeriesLabel(peakDay.date) : "No clicks yet";
  const shareOfAll =
    allTotal === 0 ? 0 : Math.round(((overview?.total ?? 0) / allTotal) * 100);
  const missingLink = hydrated && Boolean(linkId) && !linkFilter;

  if (!hydrated || (loading && !overview)) return <AnalyticsFallback />;

  return (
    <DashboardFrame preview={<DashboardPreview />}>
      <PageHeader
        title="Analytics"
        description="Track your link performance and understand where your audience comes from."
        actions={
          <RangeSelect value={range} onChange={setRange} className="w-auto min-w-40" />
        }
      />

      {linkFilter ? (
        <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 p-3">
          <p className="text-sm text-zinc-700">
            Showing analytics for{" "}
            <span className="font-semibold text-zinc-900">{linkFilter.title}</span>.
          </p>
          <Button asChild variant="secondary" size="sm">
            <Link href="/dashboard/analytics">Show all links</Link>
          </Button>
        </Card>
      ) : missingLink ? (
        <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 border-amber-200 bg-amber-50 p-3">
          <p className="text-sm text-amber-900">
            We couldn&apos;t find that link. Showing analytics for all links.
          </p>
          <Button asChild variant="secondary" size="sm">
            <Link href="/dashboard/analytics">Dismiss</Link>
          </Button>
        </Card>
      ) : null}

      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-5">
        <StatCard
          label="Total recorded clicks"
          value={formatNumber(overview?.total ?? 0)}
          sub={<DeltaPill change={overview?.change ?? null} />}
          icon={BarChart3}
          tip={CLICKS_TIP}
          sparkline={(overview?.series ?? []).map((point) => point.count)}
        />
        <StatCard
          label="Unique clicks"
          value={uniqueTotal === null ? "—" : formatNumber(uniqueTotal)}
          sub={
            uniqueTotal === null
              ? "Not tracked for part of this range"
              : "Daily unique clicks"
          }
          icon={Users}
          tip={UNIQUE_TIP}
          sparkline={
            uniqueTotal === null
              ? undefined
              : (overview?.series ?? []).map(
                  (point) => point.uniqueCount ?? 0,
                )
          }
        />
        <StatCard
          label="Avg clicks / day"
          value={(overview?.averagePerDay ?? 0).toFixed(1)}
          sub={<DeltaPill change={overview?.change ?? null} />}
          icon={Star}
          sparkline={(overview?.series ?? []).map((point) => point.count)}
        />
        {linkFilter ? (
          <StatCard
            label="Share of all clicks"
            value={`${shareOfAll}%`}
            sub={`${formatNumber(allTotal)} total clicks`}
            icon={PieChart}
          />
        ) : (
          <StatCard
            label="Active links"
            value={`${overview?.activeLinks ?? 0} / ${LIMITS.maxLinks}`}
            sub={`${overview?.totalLinks ?? 0} total`}
            icon={Link2}
          />
        )}
        <StatCard
          label="Peak day"
          value={formatNumber(peakValue)}
          sub={peakLabel}
          icon={Heart}
        />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold text-zinc-900">Clicks over time</h2>
            <span className="text-xs text-zinc-500">UTC</span>
          </div>
          <ClicksChart
            data={overview?.series ?? []}
            rangeDays={range}
            height={224}
            showUnique
          />
        </Card>

        <Card className="p-5">
          <h2 className="font-bold text-zinc-900">Traffic sources</h2>
          <p className="mb-2 text-xs text-zinc-600">Referrer domains</p>
          <div className="flex flex-col items-center gap-3">
            <DonutChart
              data={overview?.referrers ?? []}
              centerValue={formatNumber(overview?.total ?? 0)}
              centerLabel="clicks"
              height={128}
            />
            <ul className="w-full space-y-1.5 text-xs">
              {(overview?.referrers ?? []).map((slice) => (
                <li key={slice.key} className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span className="min-w-0 flex-1 truncate text-zinc-700">{slice.label}</span>
                  <span className="font-semibold text-zinc-900">{formatNumber(slice.count)}</span>
                  <span className="w-9 text-right text-zinc-600">
                    {Math.round(slice.share * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="p-5">
          <h2 className="mb-3 font-bold text-zinc-900">Devices</h2>
          <div className="flex flex-col items-center gap-3">
            <DonutChart
              data={overview?.devices ?? []}
              centerValue={formatNumber(overview?.total ?? 0)}
              centerLabel="clicks"
              height={112}
            />
            <ul className="w-full space-y-2 text-xs">
              {(overview?.devices ?? []).map((slice) => (
                <li key={slice.key} className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span className="min-w-0 flex-1 text-zinc-700">{slice.label}</span>
                  <span className="font-semibold text-zinc-900">{formatNumber(slice.count)}</span>
                  <span className="w-9 text-right text-zinc-600">
                    {Math.round(slice.share * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 font-bold text-zinc-900">Top countries</h2>
          <ul className="space-y-2.5 text-xs">
            {(overview?.countries ?? []).map((slice) => (
              <li key={slice.key} className="flex items-center gap-2">
                <span className="w-24 shrink-0 truncate text-zinc-700">{slice.label}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-violet-50">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${Math.round(slice.share * 100)}%`,
                      backgroundColor: slice.color,
                    }}
                  />
                </span>
                <span className="w-8 text-right font-semibold text-zinc-900">
                  {Math.round(slice.share * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 flex items-center gap-2 font-bold text-zinc-900">
            <span aria-hidden="true">💡</span> Insights
          </h2>
          <ul className="space-y-2 text-sm text-zinc-800">
            {(overview?.insights ?? []).length === 0 ? (
              <li className="text-zinc-600">Not enough data yet.</li>
            ) : (
              (overview?.insights ?? []).map((insight) => (
                <li key={insight} className="flex gap-2">
                  <span
                    aria-hidden="true"
                    className="mt-1.5 size-1.5 shrink-0 rounded-full bg-violet-600"
                  />
                  <span>{insight}</span>
                </li>
              ))
            )}
          </ul>
        </Card>
      </div>

      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold text-zinc-900">Link performance</h2>
          <Button asChild variant="secondary" size="sm">
            <Link href="/dashboard/export">Export data</Link>
          </Button>
        </div>

        {state.links.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="No links to analyze yet"
            description="Add your first link and share your page to start collecting clicks."
            action={
              <Button asChild>
                <Link href="/dashboard/links?add=1">Add your first link</Link>
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <caption className="sr-only">
                Recorded clicks and daily unique clicks per link in the selected range
              </caption>
              <thead>
                <tr className="border-b border-violet-100 text-left text-xs text-zinc-600">
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    #
                  </th>
                  <th scope="col" className="font-semibold">
                    Link
                  </th>
                  <th scope="col" className="font-semibold">
                    Category
                  </th>
                  <th scope="col" className="text-right font-semibold">
                    Clicks
                  </th>
                  <th scope="col" className="text-right font-semibold">
                    Unique clicks
                  </th>
                  <th scope="col" className="text-right font-semibold">
                    Share
                  </th>
                  <th scope="col" className="pl-6 font-semibold">
                    Trend
                  </th>
                </tr>
              </thead>
              <tbody>
                {linkRows.map((row, index) => (
                  <tr key={row.link.id} className="border-b border-violet-50 last:border-0">
                    <td className="py-2.5 pr-3 text-xs text-zinc-500">{index + 1}</td>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2.5">
                        <LinkIcon
                          icon={row.link.icon}
                          url={row.link.url}
                          className="size-5 text-violet-700"
                        />
                        <span className="font-semibold text-zinc-900">{row.link.title}</span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-3">
                      <CategoryPill
                        category={
                          row.link.categoryId
                            ? categoriesById.get(row.link.categoryId) ?? null
                            : null
                        }
                      />
                    </td>
                    <td className="py-2.5 text-right font-semibold">
                      {formatNumber(row.count)}
                    </td>
                    <td className="py-2.5 text-right text-zinc-600">
                      {row.uniqueCount === null || row.uniqueCount === undefined
                        ? "—"
                        : formatNumber(row.uniqueCount)}
                    </td>
                    <td className="py-2.5 text-right text-zinc-600">
                      {Math.round(row.share * 100)}%
                    </td>
                    <td className="py-2.5 pl-6">
                      <Sparkline values={row.series} width={80} height={24} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="mt-4 text-xs text-zinc-500">
        Days are UTC. Recorded clicks exclude known bots and repeat taps within a
        few seconds. Unique clicks count distinct visitors per link per day; they
        start with the first nightly rollup after unique tracking was deployed,
        so earlier days show —.
      </p>
    </DashboardFrame>
  );
}
