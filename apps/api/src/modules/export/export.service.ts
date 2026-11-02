import JSZip from "jszip";
import type { Category, Link, Plan, Profile } from "@prisma/client";
import {
  EXPORT_SCHEMA_VERSION,
  type AppearanceSettings,
  type SocialLinks,
} from "@linkhub/shared";
import { prisma } from "../../lib/db";
import { parseAppearance, parseSocials } from "../../lib/dto";
import { entitlementsFor } from "../../lib/entitlements";
import { fail } from "../../lib/errors";
import {
  getExportHistory,
  type ExportHistory,
} from "../analytics/analytics.service";
import type { ExportOptions, ExportSection } from "./export.schema";

interface ExportData {
  profile: Profile;
  categories: Category[];
  links: Link[];
  categoryNameById: Map<string, string>;
  linkTitles: Map<string, string>;
  history: ExportHistory | null;
  historyDays: number;
  appearance: AppearanceSettings;
  socials: SocialLinks;
}

export interface ExportArtifact {
  filename: string;
  contentType: string;
  body: Buffer;
}

const ANALYTICS_NOTE =
  "Recorded clicks are estimates; known bots and rapid repeat taps are filtered out. Unique clicks are distinct visitor hashes per link per UTC day and begin with the first rollup after unique tracking was deployed; earlier days are null. Days are UTC.";

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Spreadsheet programs execute cells that start with these characters. */
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(",");
}

async function loadExportData(
  userId: string,
  plan: Plan,
  options: ExportOptions,
): Promise<ExportData> {
  const includeAnalytics = options.sections.has("analytics");
  const historyDays = entitlementsFor(plan).analyticsHistoryDays;

  const [profile, categories, links, titleRows, history] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.category.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.link.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    includeAnalytics
      ? prisma.link.findMany({
          where: { userId },
          select: { id: true, title: true },
        })
      : Promise.resolve([]),
    includeAnalytics
      ? getExportHistory(userId, historyDays)
      : Promise.resolve(null),
  ]);

  if (!profile) throw fail.notFound();

  return {
    profile,
    categories,
    links,
    categoryNameById: new Map(categories.map((category) => [category.id, category.name])),
    linkTitles: new Map(titleRows.map((link) => [link.id, link.title])),
    history,
    historyDays,
    appearance: parseAppearance(profile.theme),
    socials: parseSocials(profile.socials),
  };
}

function profileSection(data: ExportData) {
  return {
    username: data.profile.username,
    displayName: data.profile.displayName,
    headline: data.profile.headline ?? "",
    bio: data.profile.bio ?? "",
    avatarUrl: data.profile.avatarUrl ?? "",
    socials: data.socials,
    isPublished: data.profile.isPublished,
    url: `/${data.profile.username}`,
  };
}

function categoryName(data: ExportData, categoryId: string | null): string | null {
  if (!categoryId) return null;
  return data.categoryNameById.get(categoryId) ?? null;
}

function fullLinks(data: ExportData, includeAnalytics: boolean) {
  return data.links.map((link, index) => ({
    position: index + 1,
    title: link.title,
    url: link.url,
    type: link.type,
    config: link.config,
    description: link.description ?? "",
    category: categoryName(data, link.categoryId),
    icon: link.icon,
    isActive: link.isActive,
    createdAt: link.createdAt.toISOString(),
    ...(includeAnalytics
      ? { clicksLast365Days: data.history?.linkTotals.get(link.id) ?? 0 }
      : {}),
  }));
}

function publicLinks(data: ExportData) {
  const hidden = new Set(
    data.categories
      .filter((category) => !category.isVisible)
      .map((category) => category.id),
  );

  return data.links
    .filter(
      (link) =>
        link.isActive && (!link.categoryId || !hidden.has(link.categoryId)),
    )
    .map((link, index) => ({
      position: index + 1,
      title: link.title,
      url: link.url,
      type: link.type,
      config: link.config,
      description: link.description ?? "",
      category: categoryName(data, link.categoryId),
      icon: link.icon,
    }));
}

function fullCategories(data: ExportData) {
  return data.categories.map((category, index) => ({
    position: index + 1,
    name: category.name,
    description: category.description ?? "",
    color: category.color,
    icon: category.icon,
    isVisible: category.isVisible,
  }));
}

function analyticsSection(history: ExportHistory, historyDays: number) {
  const dailyMap = new Map<
    string,
    { clicks: number; uniqueClicks: number; tracked: boolean }
  >();
  for (const row of history.daily) {
    const entry = dailyMap.get(row.date) ?? {
      clicks: 0,
      uniqueClicks: 0,
      tracked: true,
    };
    entry.clicks += row.count;
    if (row.uniqueCount === null) entry.tracked = false;
    else entry.uniqueClicks += row.uniqueCount;
    dailyMap.set(row.date, entry);
  }

  const daily = Array.from(dailyMap.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, totals]) => ({
      date,
      clicks: totals.clicks,
      uniqueClicks: totals.tracked ? totals.uniqueClicks : null,
    }));

  return {
    note: ANALYTICS_NOTE,
    historyDays,
    totalClicks: daily.reduce((sum, row) => sum + row.clicks, 0),
    totalUniqueClicks: daily.some((row) => row.uniqueClicks === null)
      ? null
      : daily.reduce((sum, row) => sum + (row.uniqueClicks ?? 0), 0),
    daily,
  };
}

function buildJson(data: ExportData, sections: Set<ExportSection>) {
  const includeAnalytics = sections.has("analytics") && data.history !== null;

  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    ...(sections.has("profile")
      ? { profile: profileSection(data), appearance: data.appearance }
      : {}),
    ...(sections.has("links")
      ? { links: fullLinks(data, includeAnalytics) }
      : {}),
    ...(sections.has("categories")
      ? { categories: fullCategories(data) }
      : {}),
    ...(includeAnalytics
      ? {
          analytics: analyticsSection(
            data.history as ExportHistory,
            data.historyDays,
          ),
        }
      : {}),
  };
}

function buildProfileJson(data: ExportData) {
  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    profile: profileSection(data),
    appearance: data.appearance,
    links: publicLinks(data),
  };
}

function buildCsvFiles(
  data: ExportData,
  sections: Set<ExportSection>,
): Record<string, string> {
  const files: Record<string, string> = {};
  const includeAnalytics = sections.has("analytics") && data.history !== null;

  if (sections.has("profile")) {
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
        data.profile.displayName,
        data.profile.username,
        data.profile.headline ?? "",
        data.profile.bio ?? "",
        data.profile.avatarUrl ?? "",
        `/${data.profile.username}`,
        data.profile.isPublished,
        data.socials.website,
        data.socials.github,
        data.socials.linkedin,
        data.socials.x,
        data.socials.medium,
        data.socials.email,
      ]),
    ].join("\n");
  }

  if (sections.has("links")) {
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
        ...(includeAnalytics ? ["clicks_last_365_days"] : []),
      ]),
      ...data.links.map((link, index) =>
        csvRow([
          index + 1,
          link.title,
          link.url,
          link.description ?? "",
          categoryName(data, link.categoryId) ?? "",
          link.icon,
          link.isActive,
          link.createdAt.toISOString(),
          ...(includeAnalytics
            ? [data.history?.linkTotals.get(link.id) ?? 0]
            : []),
        ]),
      ),
    ].join("\n");
  }

  if (sections.has("categories")) {
    files["categories.csv"] = [
      csvRow(["position", "name", "description", "color", "icon", "visible"]),
      ...data.categories.map((category, index) =>
        csvRow([
          index + 1,
          category.name,
          category.description ?? "",
          category.color,
          category.icon,
          category.isVisible,
        ]),
      ),
    ].join("\n");
  }

  if (includeAnalytics) {
    const history = data.history as ExportHistory;

    files["daily_stats.csv"] = [
      csvRow(["date", "link_id", "link_title", "clicks", "unique_clicks"]),
      ...history.daily.map((row) =>
        csvRow([
          row.date,
          row.linkId,
          data.linkTitles.get(row.linkId) ?? "Deleted link",
          row.count,
          row.uniqueCount,
        ]),
      ),
    ].join("\n");

    files["daily_breakdowns.csv"] = [
      csvRow(["date", "link_id", "dimension", "value", "clicks"]),
      ...history.breakdowns.map((row) =>
        csvRow([
          row.date,
          row.linkId,
          row.dimension,
          row.value,
          row.count,
        ]),
      ),
    ].join("\n");
  }

  return files;
}

export async function buildExport(
  userId: string,
  plan: Plan,
  options: ExportOptions,
): Promise<ExportArtifact> {
  const data = await loadExportData(userId, plan, options);
  const date = isoToday();

  if (options.format === "csv") {
    const files = buildCsvFiles(data, options.sections);
    if (Object.keys(files).length === 0) {
      throw fail.validation("Choose at least one section to export.");
    }

    const zip = new JSZip();
    for (const [name, content] of Object.entries(files)) {
      zip.file(name, content);
    }
    const body = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    return {
      filename: `linkhub-export-${date}.zip`,
      contentType: "application/zip",
      body,
    };
  }

  const payload =
    options.format === "profile"
      ? buildProfileJson(data)
      : buildJson(data, options.sections);

  return {
    filename:
      options.format === "profile"
        ? `linkhub-profile-${date}.json`
        : `linkhub-export-${date}.json`,
    contentType: "application/json; charset=utf-8",
    body: Buffer.from(JSON.stringify(payload, null, 2), "utf8"),
  };
}
