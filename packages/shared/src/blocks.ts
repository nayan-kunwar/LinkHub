import { z } from "zod";
import {
  LIMITS,
  LINK_LAYOUTS,
  LINK_TYPES,
  type LinkType,
} from "./constants";
import type { Link } from "./types";

const httpsUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        url.protocol === "https:" &&
        !url.username &&
        !url.password &&
        url.hostname.includes(".")
      );
    } catch {
      return false;
    }
  }, "Use an https:// link.");

/** "" means "not set". */
const optionalHttpsUrl = z.union([z.literal(""), httpsUrl]);

const text = (max: number) => z.string().trim().max(max, `Keep it under ${max} characters.`);

// ── per-type config ────────────────────────────────────────────────
export const linkConfigSchema = z.strictObject({
  layout: z.enum(LINK_LAYOUTS).default("classic"),
  subtitle: text(LIMITS.maxSubtitle).default(""),
  imageUrl: optionalHttpsUrl.default(""),
  usePreviewImage: z.boolean().default(true),
});

export const headerConfigSchema = z.strictObject({
  subtitle: text(LIMITS.maxSubtitle).default(""),
});

export const youtubeConfigSchema = z.strictObject({
  videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/, "Paste a YouTube video link."),
});

const phone = z.union([
  z.literal(""),
  z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number."),
]);

export const contactConfigSchema = z
  .strictObject({
    email: z.union([z.literal(""), z.email("Enter a valid email.")]).default(""),
    phone: phone.default(""),
    whatsapp: phone.default(""),
  })
  .refine((config) => config.email || config.phone || config.whatsapp, {
    message: "Add at least one way to reach you.",
  });

export const linkConfigSchemas = {
  link: linkConfigSchema,
  header: headerConfigSchema,
  youtube: youtubeConfigSchema,
  contact: contactConfigSchema,
} as const;

export type LinkConfigMap = {
  [K in LinkType]: z.infer<(typeof linkConfigSchemas)[K]>;
};

export type LinkConfig = LinkConfigMap[LinkType];

// ── discriminated block for the renderer ───────────────────────────
export type Block = {
  [K in LinkType]: { type: K; link: Link; config: LinkConfigMap[K] };
}[LinkType];

export function isLinkType(value: string): value is LinkType {
  return (LINK_TYPES as readonly string[]).includes(value);
}

/** Returns null when the stored config is unusable; the renderer skips that block. */
export function toBlock(link: Link): Block | null {
  const type = isLinkType(link.type) ? link.type : "link";
  const parsed = linkConfigSchemas[type].safeParse(link.config ?? {});
  if (!parsed.success) return null;
  return { type, link, config: parsed.data } as Block;
}

/** Mirrors parseAppearance: never throw on stored data, fall back to defaults. */
export function parseLinkConfig(type: string, raw: unknown): Record<string, unknown> {
  if (!isLinkType(type)) return {};
  const schema = linkConfigSchemas[type];
  const parsed = schema.safeParse(raw ?? {});
  if (parsed.success) return parsed.data;
  const fallback = schema.safeParse({});
  return fallback.success ? fallback.data : {};
}

export function defaultConfigFor(type: LinkType): Record<string, unknown> {
  const parsed = linkConfigSchemas[type].safeParse({});
  return parsed.success ? parsed.data : {};
}

// ── YouTube (allowlist: only these hosts, only an 11-char id is kept) ─
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
]);

export function parseYouTubeId(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !YOUTUBE_HOSTS.has(url.hostname.toLowerCase())) {
    return null;
  }
  let id: string | null = null;
  if (url.hostname.toLowerCase() === "youtu.be") {
    id = url.pathname.slice(1).split("/")[0] || null;
  } else if (url.pathname === "/watch") {
    id = url.searchParams.get("v");
  } else {
    const match = url.pathname.match(/^\/(?:shorts|embed|live)\/([^/?#]+)/);
    id = match?.[1] ?? null;
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

// ── Provider detection (used for subtitles/icons) ─────────────────
const PROVIDERS = [
  { id: "youtube", label: "YouTube", hosts: ["youtube.com", "youtu.be"] },
  { id: "spotify", label: "Spotify", hosts: ["spotify.com", "spoti.fi"] },
  { id: "instagram", label: "Instagram", hosts: ["instagram.com", "instagr.am"] },
  {
    id: "amazon",
    label: "Amazon",
    hosts: ["amazon.in", "amazon.com", "amzn.to", "amzn.in", "a.co"],
  },
] as const;

export type ProviderId = (typeof PROVIDERS)[number]["id"];

export function detectProvider(rawUrl: string): { id: ProviderId; label: string } | null {
  try {
    const host = new URL(rawUrl).hostname.toLowerCase();
    const hit = PROVIDERS.find((provider) =>
      provider.hosts.some((candidate) => host === candidate || host.endsWith(`.${candidate}`)),
    );
    return hit ? { id: hit.id, label: hit.label } : null;
  } catch {
    return null;
  }
}
