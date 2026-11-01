import "server-only";
import { cache } from "react";
import {
  RESERVED_USERNAMES,
  USERNAME_REGEX,
  type AppearanceSettings,
  type SocialLinks,
} from "@linkhub/shared";

export interface PublicProfileData {
  profile: {
    username: string;
    displayName: string;
    headline: string;
    bio: string;
    avatarUrl: string;
    socials: SocialLinks;
  };
  appearance: AppearanceSettings;
  categories: Array<{
    id: string;
    name: string;
    description: string;
    color: string;
    icon: string;
    sortOrder: number;
  }>;
  links: Array<{
    id: string;
    title: string;
    url: string;
    type: string;
    config: Record<string, unknown>;
    previewImageUrl: string;
    description: string;
    categoryId: string | null;
    icon: string;
    sortOrder: number;
  }>;
}

interface Envelope<T> {
  success: true;
  data: T;
}

export function profileCacheTag(username: string): string {
  return `profile:${username.trim().toLowerCase()}`;
}

async function fetchPublicProfileUncached(
  rawUsername: string,
): Promise<PublicProfileData | null> {
  const username = rawUsername.trim().toLowerCase();
  if (
    !USERNAME_REGEX.test(username) ||
    (RESERVED_USERNAMES as readonly string[]).includes(username)
  ) {
    return null;
  }

  const baseUrl = process.env.API_BASE_URL?.replace(/\/$/, "");
  if (!baseUrl) {
    throw new Error("API_BASE_URL is not configured for the web app.");
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  const internalToken = process.env.INTERNAL_FETCH_TOKEN;
  if (internalToken) headers["x-internal-token"] = internalToken;

  const response = await fetch(
    `${baseUrl}/api/v1/public/profiles/${encodeURIComponent(username)}`,
    {
      cache: "force-cache",
      headers,
      next: {
        revalidate: 300,
        tags: [profileCacheTag(username)],
      },
    },
  );

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Public profile request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as Envelope<PublicProfileData>;
  return payload.data;
}

/**
 * Deduped per request so generateMetadata and the page share one API call.
 * Cached for 300 s and purged by the API through /internal/revalidate.
 */
export const getPublicProfile = cache(fetchPublicProfileUncached);
