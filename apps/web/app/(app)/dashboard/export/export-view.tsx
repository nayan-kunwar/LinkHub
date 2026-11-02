"use client";

import { useMemo, useState } from "react";
import { Check, Clipboard, Download, FileJson, FileSpreadsheet, ShieldCheck, User } from "lucide-react";
import { toast } from "sonner";
import type { DailyPoint, Profile } from "@linkhub/shared";
import { APP_NAME, EXPORT_SCHEMA_VERSION, LIMITS } from "@linkhub/shared";
import { PageHeader } from "@/components/page-header";
import { DashboardFrame } from "@/components/dashboard-frame";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/input";
import { sumSeries, sumUniqueSeries, useAnalytics } from "@/lib/analytics";
import { api, type ExportFormat, type ExportSection } from "@/lib/api-client";
import type { AppState } from "@/lib/app-state";
import { useAppData } from "@/lib/store";
import { cn } from "@/lib/utils";

type IncludeKey = ExportSection;

const FORMATS: Array<{
  id: ExportFormat;
  title: string;
  description: string;
  icon: typeof FileJson;
  recommended?: boolean;
}> = [
  {
    id: "json",
    title: "JSON export",
    description: "Complete data in a structured JSON file.",
    icon: FileJson,
    recommended: true,
  },
  {
    id: "csv",
    title: "CSV export",
    description: "A zip of profile, links, categories, daily stats and breakdowns.",
    icon: FileSpreadsheet,
  },
  {
    id: "profile",
    title: "Profile only",
    description: "Public profile, links and appearance (JSON).",
    icon: User,
  },
];

const INCLUDES: Array<{ key: IncludeKey; title: string; description: string }> = [
  {
    key: "profile",
    title: "Profile information",
    description: "Name, username, headline, bio, social links, appearance",
  },
  {
    key: "links",
    title: "Links",
    description: "Titles, URLs, categories, status and position",
  },
  {
    key: "categories",
    title: "Categories",
    description: "Names, descriptions, colors, icons and visibility",
  },
  {
    key: "analytics",
    title: "Analytics daily stats",
    description: "Recorded clicks per day, per link, country, device and referrer",
  },
];

const CSV_FILES = [
  "profile.csv",
  "links.csv",
  "categories.csv",
  "daily_stats.csv",
  "daily_breakdowns.csv",
];

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Spreadsheet programs execute cells that start with these characters. */
function csvCell(value: unknown): string {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(",");
}

function publicProfile(profile: Profile) {
  return {
    username: profile.username,
    displayName: profile.displayName,
    headline: profile.headline,
    bio: profile.bio,
    avatarUrl: profile.avatarUrl,
    socials: profile.socials,
    isPublished: profile.isPublished,
    url: `/${profile.username}`,
  };
}

function publicLinks(state: AppState) {
  const categories = new Map(state.categories.map((category) => [category.id, category]));
  const hidden = new Set(
    state.categories.filter((category) => !category.isVisible).map((category) => category.id),
  );
  return state.links
    .filter((link) => link.isActive && (!link.categoryId || !hidden.has(link.categoryId)))
    .map((link, index) => ({
      position: index + 1,
      title: link.title,
      url: link.url,
      description: link.description,
      category: link.categoryId ? categories.get(link.categoryId)?.name ?? null : null,
      icon: link.icon,
    }));
}

function buildJson(
  state: AppState,
  include: Record<IncludeKey, boolean>,
  format: ExportFormat,
  previewSeries: DailyPoint[],
) {
  const exportedAt = new Date().toISOString();

  if (format === "profile") {
    return {
      schemaVersion: EXPORT_SCHEMA_VERSION,
      exportedAt,
      profile: publicProfile(state.profile),
      appearance: state.appearance,
      links: publicLinks(state),
    };
  }

  const categories = new Map(state.categories.map((category) => [category.id, category]));

  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt,
    preview: true,
    ...(include.profile
      ? { profile: publicProfile(state.profile), appearance: state.appearance }
      : {}),
    ...(include.links
      ? {
          links: state.links.map((link, index) => ({
            position: index + 1,
            title: link.title,
            url: link.url,
            description: link.description,
            category: link.categoryId ? categories.get(link.categoryId)?.name ?? null : null,
            icon: link.icon,
            isActive: link.isActive,
            createdAt: link.createdAt,
          })),
        }
      : {}),
    ...(include.categories
      ? {
          categories: state.categories.map((category, index) => ({
            position: index + 1,
            name: category.name,
            description: category.description,
            color: category.color,
            icon: category.icon,
            isVisible: category.isVisible,
          })),
        }
      : {}),
    ...(include.analytics
      ? {
          analytics: {
            note: "Preview uses your current dashboard range. The downloaded export contains the full 365-day history.",
            historyDays: LIMITS.analyticsHistoryDays,
            totalClicks: sumSeries(previewSeries),
            totalUniqueClicks: sumUniqueSeries(previewSeries),
            daily: previewSeries.map((point) => ({
              date: point.date,
              clicks: point.count,
              uniqueClicks: point.uniqueCount,
            })),
          },
        }
      : {}),
  };
}

function buildCsvFiles(
  state: AppState,
  include: Record<IncludeKey, boolean>,
  previewSeries: DailyPoint[],
): Record<string, string> {
  const categories = new Map(state.categories.map((category) => [category.id, category]));
  const files: Record<string, string> = {};

  if (include.profile) {
    const profile = state.profile;
    files["profile.csv"] = [
      csvRow([
        "name",
        "username",
        "headline",
        "bio",
        "avatar_url",
        "url",
        "published",
        "website",
        "github",
        "linkedin",
        "x",
        "medium",
        "email",
      ]),
      csvRow([
        profile.displayName,
        profile.username,
        profile.headline,
        profile.bio,
        profile.avatarUrl,
        `/${profile.username}`,
        profile.isPublished,
        profile.socials.website,
        profile.socials.github,
        profile.socials.linkedin,
        profile.socials.x,
        profile.socials.medium,
        profile.socials.email,
      ]),
    ].join("\n");
  }

  if (include.links) {
    files["links.csv"] = [
      csvRow([
        "position",
        "title",
        "url",
        "description",
        "category",
        "icon",
        "active",
        "created_at",
        ...(include.analytics ? ["clicks_last_365_days"] : []),
      ]),
      ...state.links.map((link, index) =>
        csvRow([
          index + 1,
          link.title,
          link.url,
          link.description,
          link.categoryId ? categories.get(link.categoryId)?.name ?? "" : "",
          link.icon,
          link.isActive,
          link.createdAt,
          ...(include.analytics ? [""] : []),
        ]),
      ),
    ].join("\n");
  }

  if (include.categories) {
    files["categories.csv"] = [
      csvRow(["position", "name", "description", "color", "icon", "visible"]),
      ...state.categories.map((category, index) =>
        csvRow([
          index + 1,
          category.name,
          category.description,
          category.color,
          category.icon,
          category.isVisible,
        ]),
      ),
    ].join("\n");
  }

  if (include.analytics) {
    files["daily_stats.csv"] = [
      csvRow(["date", "link_id", "link_title", "clicks", "unique_clicks"]),
      ...previewSeries.map((point) =>
        csvRow([
          point.date,
          "",
          "All links",
          point.count,
          point.uniqueCount,
        ]),
      ),
    ].join("\n");

    files["daily_breakdowns.csv"] = csvRow([
      "date",
      "link_id",
      "dimension",
      "value",
      "clicks",
    ]);
  }

  return files;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ExportView() {
  const { state } = useAppData();
  const { data: overview } = useAnalytics(30);
  const [format, setFormat] = useState<ExportFormat>("json");
  const [include, setInclude] = useState<Record<IncludeKey, boolean>>({
    profile: true,
    links: true,
    categories: true,
    analytics: true,
  });
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const previewSeries = overview?.series ?? [];
  const isProfileOnly = format === "profile";
  const effectiveInclude = isProfileOnly
    ? { profile: true, links: true, categories: false, analytics: false }
    : include;
  const nothingSelected = !Object.values(effectiveInclude).some(Boolean);

  const preview = useMemo(() => {
    if (format === "csv") {
      const files = buildCsvFiles(state, effectiveInclude, previewSeries);
      const names = Object.keys(files);
      if (names.length === 0) return "# nothing selected";
      const listing = [
        "CSV export (zip)",
        "",
        ...CSV_FILES.filter((name) => names.includes(name)).map((name) => `  ${name}`),
        "",
        `# ${names[0]}`,
        "",
        files[names[0]].split("\n").slice(0, 40).join("\n"),
      ];
      return listing.join("\n");
    }
    return JSON.stringify(buildJson(state, effectiveInclude, format, previewSeries), null, 2);
  }, [state, format, effectiveInclude, previewSeries]);

  const previewText =
    preview.length > 6000 ? `${preview.slice(0, 6000)}\n… (preview truncated; the download has everything)` : preview;

  const filename = useMemo(() => {
    const date = isoToday();
    if (format === "csv") return `linkhub-export-${date}.zip`;
    if (format === "profile") return `linkhub-profile-${date}.json`;
    return `linkhub-export-${date}.json`;
  }, [format]);

  const sizeLabel = useMemo(() => {
    if (format === "csv") {
      const files = buildCsvFiles(state, effectiveInclude, previewSeries);
      const total = Object.values(files).reduce(
        (sum, content) => sum + new TextEncoder().encode(content).length,
        0,
      );
      return `${formatBytes(total)} estimated`;
    }
    return formatBytes(new TextEncoder().encode(preview).length);
  }, [state, format, effectiveInclude, preview, previewSeries]);

  const toggleInclude = (key: IncludeKey) => {
    setInclude((current) => ({ ...current, [key]: !current[key] }));
  };

  const copyPreview = async () => {
    try {
      await navigator.clipboard.writeText(preview);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy. Select the preview and copy manually.");
    }
  };

  const download = async () => {
    if (nothingSelected) return;
    setBusy(true);
    try {
      const selected = (Object.keys(effectiveInclude) as IncludeKey[]).filter(
        (key) => effectiveInclude[key],
      );
      const artifact = await api.export.download(
        format,
        isProfileOnly ? undefined : selected,
      );
      downloadBlob(artifact.blob, artifact.filename);
      toast.success(`Downloaded ${artifact.filename}`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "The export could not be created. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardFrame>
      <PageHeader
        title="Export"
        description="Download your data anytime, as a backup or to move to another platform."
      />

      <div
        className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3"
        role="radiogroup"
        aria-label="Export format"
      >
        {FORMATS.map((option) => {
          const Icon = option.icon;
          const selected = format === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setFormat(option.id)}
              className={cn(
                "rounded-2xl border-2 bg-white p-4 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200",
                selected
                  ? "border-violet-700 ring-2 ring-violet-100"
                  : "border-line hover:border-violet-300",
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-bold text-zinc-900">
                  <Icon aria-hidden="true" className="size-5 text-violet-700" />
                  {option.title}
                </span>
                {selected ? (
                  <span className="flex size-5 items-center justify-center rounded-full bg-violet-700 text-white">
                    <Check aria-hidden="true" className="size-3" strokeWidth={3} />
                  </span>
                ) : null}
              </span>
              <span className="mt-1 block text-sm text-zinc-700">{option.description}</span>
              {option.recommended ? (
                <span className="mt-2 inline-flex rounded-full bg-violet-100 px-2.5 py-0.5 text-[11px] font-semibold text-violet-900">
                  Recommended
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-bold text-zinc-900">What&apos;s included</h2>
          <p className="mb-2 text-sm text-zinc-700">
            {isProfileOnly
              ? "Profile only always exports your public profile, links and appearance."
              : "Choose the data to include."}
          </p>

          <ul className={cn(isProfileOnly && "opacity-60")}>
            {INCLUDES.map((item) => (
              <li
                key={item.key}
                className="flex items-start gap-3 border-b border-violet-50 py-2.5 last:border-0"
              >
                <Checkbox
                  id={`export-${item.key}`}
                  checked={effectiveInclude[item.key]}
                  disabled={isProfileOnly}
                  onCheckedChange={() => toggleInclude(item.key)}
                  className="mt-1"
                />
                <div className="min-w-0">
                  <Label
                    htmlFor={`export-${item.key}`}
                    className={cn("mb-0 font-semibold", isProfileOnly ? "cursor-default" : "cursor-pointer")}
                  >
                    {item.title}
                  </Label>
                  <p className="text-xs text-zinc-600">{item.description}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex gap-2 rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm text-violet-950">
            <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <p>
              <strong>Never included:</strong> your password, email address, active sessions and
              any authentication or verification tokens.
            </p>
          </div>

          {nothingSelected ? (
            <p role="alert" className="mt-3 text-sm font-semibold text-amber-900">
              Select at least one section to export.
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={() => void download()} disabled={busy || nothingSelected}>
              <Download aria-hidden="true" className="size-4" />
              {busy ? "Preparing…" : `Download ${filename}`}
            </Button>
            <span className="text-xs text-zinc-600">{sizeLabel}</span>
          </div>

          <p className="mt-3 text-xs text-zinc-500">
            Exports are limited to {LIMITS.exportRatePerHour} per hour. {APP_NAME} never emails your
            export automatically.
          </p>
        </Card>

        <Card className="flex flex-col p-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="font-bold text-zinc-900">Export preview</h2>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => void copyPreview()}
              aria-label={copied ? "Preview copied" : "Copy preview"}
            >
              {copied ? (
                <Check aria-hidden="true" className="size-4 text-green-700" />
              ) : (
                <Clipboard aria-hidden="true" className="size-4" />
              )}
            </Button>
          </div>
          <pre
            tabIndex={0}
            aria-label="Export preview"
            className="h-[26rem] flex-1 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-[#1e1b4b] p-4 text-xs text-violet-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-300"
          >
            {previewText}
          </pre>
          <p className="mt-2 text-xs text-zinc-600">
            The preview uses your last 30 days of dashboard data. The downloaded file is generated
            by the API with the full 365-day history.
          </p>
          {format === "csv" ? (
            <p className="mt-1 text-xs text-zinc-600">
              The zip contains {effectiveInclude.analytics ? "five" : "three"} CSVs:{" "}
              {CSV_FILES.filter((name) =>
                name === "daily_stats.csv" || name === "daily_breakdowns.csv"
                  ? effectiveInclude.analytics
                  : true,
              ).join(", ")}.
            </p>
          ) : null}
        </Card>
      </div>

      <p className="mt-4 text-xs text-zinc-500">
        Analytics days are UTC. Recorded clicks are estimates; known bots and rapid repeat taps are
        filtered out. CSV cells are escaped to prevent spreadsheet formula injection.
      </p>
    </DashboardFrame>
  );
}
