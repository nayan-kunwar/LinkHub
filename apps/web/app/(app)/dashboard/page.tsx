"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  BarChart3,
  Folder,
  Link2,
  Pencil,
  Plus,
  Star,
} from "lucide-react";
import { LIMITS } from "@linkhub/shared";
import { toast } from "sonner";
import { DashboardFrame } from "@/components/dashboard-frame";
import { DashboardPreview } from "@/components/dashboard-preview";
import { PageHeader } from "@/components/page-header";
import { RangeSelect } from "@/components/range-select";
import { StatCard } from "@/components/stat-card";
import { DeltaPill } from "@/components/delta-pill";
import { ClicksChart } from "@/components/charts/clicks-chart";
import { CategoryPill } from "@/components/category-pill";
import { LinkIcon } from "@/components/link-icon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { InfoTip } from "@/components/ui/info-tip";
import { useMockData } from "@/lib/store";
import { useRange } from "@/lib/use-range";
import { getAnalytics, getLinkClickCount } from "@/lib/analytics";
import { formatNumber } from "@/lib/utils";

const ACC_TIP =
  "Recorded clicks count taps on your links. Known bots and repeat taps within a few seconds are filtered out, so treat totals as close estimates, not exact visitor counts.";

export default function DashboardPage() {
  const { state, toggleLink } = useMockData();
  const [range, setRange] = useRange(30);
  const overview = useMemo(() => getAnalytics(state, range), [state, range]);
  const counts = useMemo(
    () => new Map(state.links.map((link) => [link.id, getLinkClickCount(state, link, range)])),
    [state, range],
  );
  const categoriesById = useMemo(
    () => new Map(state.categories.map((category) => [category.id, category])),
    [state.categories],
  );
  const inactiveCount = state.links.length - overview.activeLinks;
  const hiddenCategories = state.categories.filter((category) => !category.isVisible).length;

  const toggle = (id: string, title: string) => {
    const link = state.links.find((item) => item.id === id);
    toggleLink(id);
    toast.success(`${title} ${link?.isActive ? "deactivated" : "activated"}`);
  };

  return (
    <DashboardFrame preview={<DashboardPreview />}>
      <PageHeader
        title="Dashboard"
        description="Manage your links, track performance and customize your profile."
        actions={<RangeSelect value={range} onChange={setRange} />}
      />

      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Total recorded clicks"
          value={formatNumber(overview.total)}
          sub={
            <span className="flex flex-wrap items-center gap-1.5">
              <DeltaPill change={overview.change} />
              <span>last {range} days</span>
            </span>
          }
          icon={BarChart3}
          tip={ACC_TIP}
        />
        <StatCard
          label="Active links"
          value={`${overview.activeLinks} / ${LIMITS.maxLinks}`}
          sub={`${inactiveCount} inactive`}
          icon={Link2}
        />
        <StatCard
          label="Categories"
          value={state.categories.length}
          sub={`${hiddenCategories} hidden`}
          icon={Folder}
        />
        <StatCard
          label="Avg clicks / day"
          value={overview.averagePerDay.toFixed(1)}
          sub={<DeltaPill change={overview.change} />}
          icon={Star}
        />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold text-zinc-900">Clicks over time</h2>
            <span className="text-xs text-zinc-500">UTC</span>
          </div>
          <ClicksChart data={overview.series} rangeDays={range} />
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold text-zinc-900">Top links</h2>
            <Link href="/dashboard/analytics" className="text-sm font-semibold text-violet-800 hover:underline">
              View all
            </Link>
          </div>
          <ol className="space-y-3">
            {overview.topLinks.length === 0 ? (
              <p className="py-8 text-center text-sm text-zinc-500">No link clicks yet.</p>
            ) : (
              overview.topLinks.map((item) => {
                const link = state.links.find((candidate) => candidate.id === item.linkId);
                const max = overview.topLinks[0]?.count ?? 1;
                return (
                  <li key={item.linkId} className="flex items-center gap-3">
                    {link ? <LinkIcon icon={link.icon} url={link.url} className="size-6" /> : null}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-zinc-900">{item.title}</p>
                        <p className="shrink-0 text-xs text-zinc-600">{formatNumber(item.count)} clicks</p>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-violet-100">
                        <div
                          className="h-full rounded-full bg-violet-600"
                          style={{ width: `${max === 0 ? 0 : Math.round((item.count / max) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <span className="w-9 shrink-0 text-right text-xs font-semibold text-zinc-700">
                      {Math.round(item.share * 100)}%
                    </span>
                  </li>
                );
              })
            )}
          </ol>
        </Card>
      </div>

      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-zinc-900">Your links</h2>
          <div className="flex gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link href="/dashboard/links">Reorder</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/dashboard/links?add=1">
                <Plus className="size-4" /> Add link
              </Link>
            </Button>
          </div>
        </div>

        {state.links.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-zinc-600">You haven&apos;t added any links yet.</p>
            <Button asChild className="mt-4">
              <Link href="/dashboard/links?add=1">Add your first link</Link>
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <caption className="sr-only">Your links with recorded clicks in the selected range</caption>
              <thead>
                <tr className="border-b border-line text-left text-xs text-zinc-600">
                  <th scope="col" className="py-2 font-semibold">
                    Active
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
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {state.links.map((link) => {
                  const category = link.categoryId ? categoriesById.get(link.categoryId) ?? null : null;
                  const hidden = category ? !category.isVisible : false;
                  return (
                    <tr key={link.id} className="border-b border-violet-50 last:border-0">
                      <td className="py-2.5 pr-2">
                        <Switch
                          checked={link.isActive}
                          onCheckedChange={() => toggle(link.id, link.title)}
                          aria-label={`${link.title} active`}
                        />
                      </td>
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-3">
                          <LinkIcon icon={link.icon} url={link.url} className="size-6" />
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 font-semibold text-zinc-900">
                              {link.title}
                              {hidden ? (
                                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
                                  Hidden
                                </span>
                              ) : null}
                            </p>
                            <p className="max-w-[16rem] truncate text-xs text-zinc-600">{link.url}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 pr-3">
                        <CategoryPill category={category} />
                      </td>
                      <td className="py-2.5 text-right font-semibold">{formatNumber(counts.get(link.id) ?? 0)}</td>
                      <td className="py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button asChild variant="outline" size="icon-sm" aria-label={`Edit ${link.title}`}>
                            <Link href={`/dashboard/links?edit=${link.id}`}>
                              <Pencil className="size-3.5" />
                            </Link>
                          </Button>
                          <Button
                            asChild
                            variant="outline"
                            size="icon-sm"
                            aria-label={`Analytics for ${link.title}`}
                          >
                            <Link href={`/dashboard/analytics?link=${link.id}`}>
                              <BarChart3 className="size-3.5" />
                            </Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="mt-4 flex items-center gap-1.5 text-xs text-zinc-500">
        Analytics days are UTC. <InfoTip label="About analytics time">Timezone-aware analytics are planned for a later release.</InfoTip>
      </p>
    </DashboardFrame>
  );
}
