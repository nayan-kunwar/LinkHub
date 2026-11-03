/**
 * Shared, serializable contract constants used by the web app and (later) the API.
 * Keep this package free of framework imports.
 */

export const APP_NAME = "Link Hub";
export const APP_TAGLINE = "All your links in one place";

export const LIMITS = {
  maxLinks: 50,
  maxCategories: 20,
  maxLinkTitle: 60,
  maxLinkDescription: 80,
  maxSubtitle: 80,
  maxCategoryName: 40,
  maxCategoryDescription: 80,
  maxBio: 160,
  maxDisplayName: 60,
  maxHeadline: 80,
  minPassword: 12,
  maxPassword: 128,
  sessionDays: 7,
  passwordResetMinutes: 60,
  verificationHours: 24,
  deleteGraceDays: 30,
  analyticsHistoryDays: 365,
  rawEventRetentionDays: 90,
  exportRatePerHour: 5,
} as const;

export const USERNAME_REGEX = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

export const RESERVED_USERNAMES = [
  "api",
  "admin",
  "dashboard",
  "login",
  "logout",
  "signin",
  "sign-in",
  "signup",
  "sign-up",
  "signout",
  "sign-out",
  "register",
  "verify-email",
  "reset-password",
  "forgot-password",
  "check-inbox",
  "settings",
  "account",
  "internal",
  "health",
  "_next",
  "static",
  "public",
  "assets",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "terms",
  "privacy",
  "about",
  "help",
  "support",
  "docs",
  "blog",
  "pricing",
  "billing",
  "checkout",
  "upgrade",
  "plans",
  "www",
  "mail",
  "root",
  "owner",
  "null",
  "undefined",
  "me",
  "new",
  "edit",
  "profile",
  "links",
  "categories",
  "analytics",
  "export",
  "auth",
  "oauth",
  "callback",
  "webhooks",
  "cron",
  "jobs",
  "status",
  "contact",
  "legal",
  "security",
  "changelog",
  "roadmap",
  "features",
  "faq",
  "home",
  "index",
  "manifest",
  "icon",
  "apple-icon",
  "opengraph-image",
  "twitter-image",
  "well-known",
  "cdn",
  "img",
  "images",
  "media",
  "uploads",
  "files",
  "dev",
  "staging",
  "preview",
  "test",
  "metrics",
  "debug",
  "moderation",
  "start",
  "sitemap",
  "robots",
  "restore-account",
  "delete-account",
] as const;

export const SOCIAL_KEYS = ["website", "github", "linkedin", "x", "medium", "email"] as const;

export const LINK_ICON_IDS = [
  "auto",
  "link",
  "globe",
  "mail",
  "file",
  "code",
  "share",
  "briefcase",
  "book",
  "star",
  "heart",
  "archive",
  "github",
  "linkedin",
  "x",
  "medium",
  "youtube",
  "spotify",
  "instagram",
] as const;

export const CATEGORY_ICON_IDS = [
  "folder",
  "share",
  "code",
  "briefcase",
  "book",
  "mail",
  "archive",
  "globe",
  "star",
  "heart",
  "link",
  "palette",
  "music",
  "camera",
  "coffee",
  "sparkles",
] as const;

export const COLOR_PALETTE = [
  "#7c3aed",
  "#2563eb",
  "#0d9488",
  "#059669",
  "#d97706",
  "#ea580c",
  "#dc2626",
  "#db2777",
  "#a21caf",
  "#1e1b4b",
] as const;

/**
 * Sentinel stored in an optional text-colour field. The renderer resolves it
 * to pure black or white at display time, based on the current surfaces.
 */
export const AUTO_COLOR = "auto" as const;

export const APPEARANCE_COLOR_KEYS = [
  "background",
  "buttons",
  "buttonText",
  "pageText",
  "title",
] as const;

export type AppearanceColorKey = (typeof APPEARANCE_COLOR_KEYS)[number];

export const CARD_STYLES = ["rounded", "soft", "minimal", "pill"] as const;
export const BUTTON_STYLES = ["solid", "outline", "glass", "brand"] as const;
export const BACKGROUND_STYLES = ["solid", "gradient", "pattern", "blur"] as const;
export const FONT_CHOICES = ["sans", "serif"] as const;
export const LINK_TYPES = ["link", "header", "youtube", "contact"] as const;
export const LINK_LAYOUTS = ["classic", "rich", "featured"] as const;
export const PROFILE_LAYOUTS = ["grouped", "flat"] as const;

export type CardStyle = (typeof CARD_STYLES)[number];
export type ButtonStyle = (typeof BUTTON_STYLES)[number];
export type FontChoice = (typeof FONT_CHOICES)[number];
export type LinkType = (typeof LINK_TYPES)[number];
export type LinkLayout = (typeof LINK_LAYOUTS)[number];
export type ProfileLayout = (typeof PROFILE_LAYOUTS)[number];

/** Existing fields are required; everything new is optional so older presets stay valid. */
export interface ThemePresetDef {
  id: string;
  name: string;
  dark: boolean;
  /** Full CSS `background` shorthand — gradient, image, or pattern. */
  background: string;
  /** Flat colour fallback, also used by the "solid" background style. */
  solid: string;
  text: string;
  muted: string;
  /** Card/button fill. Defaults are computed from `dark` + button style. */
  surface?: string;
  /** Card/button border colour. */
  border?: string;
  /** Suggested accent copied into `appearance.color` when the preset is applied. */
  accent?: string;
  font?: FontChoice;
  card?: CardStyle;
  button?: ButtonStyle;
}

export const THEME_PRESETS = [
  {
    id: "default",
    name: "Default",
    background: "linear-gradient(180deg,#ede9fe,#f5f3ff 45%,#ddd6fe)",
    solid: "#f3efff",
    text: "#1e1b4b",
    muted: "#4c4c6a",
    dark: false,
    accent: "#7c3aed",
  },
  {
    id: "dark",
    name: "Dark",
    background: "linear-gradient(180deg,#1e1b4b,#0f0d2e)",
    solid: "#16142f",
    text: "#f5f3ff",
    muted: "#c7c3e6",
    dark: true,
    accent: "#a78bfa",
  },
  {
    id: "ocean",
    name: "Ocean",
    background: "linear-gradient(180deg,#bae6fd,#e0f2fe 50%,#7dd3fc)",
    solid: "#e0f2fe",
    text: "#0c2a43",
    muted: "#2b4a63",
    dark: false,
    accent: "#0284c7",
  },
  {
    id: "sunset",
    name: "Sunset",
    background: "linear-gradient(180deg,#fed7aa,#fecdd3 55%,#f9a8d4)",
    solid: "#ffedd5",
    text: "#431407",
    muted: "#6b3a2a",
    dark: false,
    accent: "#ea580c",
  },
  {
    id: "forest",
    name: "Forest",
    background: "linear-gradient(180deg,#bbf7d0,#dcfce7 50%,#86efac)",
    solid: "#dcfce7",
    text: "#052e16",
    muted: "#25503a",
    dark: false,
    accent: "#059669",
  },
  {
    id: "minimal",
    name: "Minimal",
    background: "#ffffff",
    solid: "#ffffff",
    text: "#18181b",
    muted: "#52525b",
    dark: false,
    accent: "#18181b",
  },
  {
    id: "rose",
    name: "Rose",
    background: "linear-gradient(180deg,#ffe4e6,#fff1f2 50%,#fecdd3)",
    solid: "#fff1f2",
    text: "#4c0519",
    muted: "#6b2a3a",
    dark: false,
    accent: "#db2777",
  },
  {
    id: "aurora",
    name: "Aurora",
    background: "linear-gradient(160deg,#0f172a,#134e4a 55%,#4c1d95)",
    solid: "#0f172a",
    text: "#ecfeff",
    muted: "#a5d8d6",
    dark: true,
    accent: "#22d3ee",
  },
  {
    id: "soft-grey",
    name: "Soft grey",
    background: "#f1f2f4",
    solid: "#f1f2f4",
    text: "#18181b",
    muted: "#5b6068",
    dark: false,
    surface: "#ffffff",
    border: "#e4e6ea",
    accent: "#18181b",
    card: "soft",
    button: "solid",
  },
  {
    id: "solid-pink",
    name: "Solid pink",
    background: "#f9c5d8",
    solid: "#f9c5d8",
    text: "#4a0d26",
    muted: "#7a2b4a",
    dark: false,
    surface: "rgba(255,255,255,0.85)",
    border: "rgba(74,13,38,0.15)",
    accent: "#be185d",
    card: "pill",
    button: "solid",
  },
  {
    id: "maroon-serif",
    name: "Maroon serif",
    background: "#5a0f1c",
    solid: "#5a0f1c",
    text: "#fdf1e7",
    muted: "#e4c4b4",
    dark: true,
    surface: "rgba(255,255,255,0.07)",
    border: "rgba(253,241,231,0.35)",
    accent: "#f5d7b5",
    font: "serif",
    card: "rounded",
    button: "outline",
  },
  {
    id: "illustrated",
    name: "Illustrated",
    background:
      "linear-gradient(rgba(0,0,0,0.28),rgba(0,0,0,0.5)), url(/themes/illustrated.svg) center top/cover no-repeat",
    solid: "#243b55",
    text: "#ffffff",
    muted: "#e5e7eb",
    dark: true,
    surface: "rgba(255,255,255,0.14)",
    border: "rgba(255,255,255,0.35)",
    accent: "#ffffff",
    card: "pill",
    button: "glass",
  },
  {
    id: "pattern-sand",
    name: "Pattern sand",
    background: "url(/themes/pattern-sand.svg) 0 0/120px 120px, #fde9b8",
    solid: "#fde9b8",
    text: "#3b2a07",
    muted: "#6b5320",
    dark: false,
    surface: "#fffaf0",
    border: "rgba(59,42,7,0.18)",
    accent: "#b45309",
    card: "rounded",
    button: "solid",
  },
] as const satisfies readonly ThemePresetDef[];

export const THEME_IDS = THEME_PRESETS.map((theme) => theme.id) as [
  (typeof THEME_PRESETS)[number]["id"],
  ...(typeof THEME_PRESETS)[number]["id"][],
];

export const EXPORT_SCHEMA_VERSION = 4;

export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://link.nayankunwar.com";
