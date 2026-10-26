import type { MetadataRoute } from "next";

interface SitemapProfile {
  username: string;
  updatedAt: string;
}

interface Envelope<T> {
  success: true;
  data: T;
}

const baseUrl = (
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
).replace(/\/$/, "");
const apiBaseUrl = process.env.API_BASE_URL?.replace(/\/$/, "");

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/`,
      changeFrequency: "weekly",
      priority: 1,
    },
  ];

  if (!apiBaseUrl) return entries;

  try {
    const response = await fetch(`${apiBaseUrl}/api/v1/public/profiles`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600, tags: ["sitemap"] },
    });
    if (!response.ok) return entries;

    const payload = (await response.json()) as Envelope<SitemapProfile[]>;
    if (!Array.isArray(payload.data)) return entries;
    for (const profile of payload.data) {
      const lastModified = new Date(profile.updatedAt);
      entries.push({
        url: `${baseUrl}/${encodeURIComponent(profile.username)}`,
        ...(Number.isNaN(lastModified.getTime()) ? {} : { lastModified }),
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
  } catch {
    // A cold or unavailable API should not break the sitemap; the hourly
    // revalidation will pick the profiles up once the API is reachable.
  }

  return entries;
}
