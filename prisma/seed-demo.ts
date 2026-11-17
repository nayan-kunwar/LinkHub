/**
 * Seeds the owner's showcase dataset end to end.
 *
 * Everything that users can create through the product is created through the
 * real HTTP API: the profile, appearance, categories, links, reordering and
 * status. Analytics are the one exception — the click API is origin- and
 * rate-limited and stamps its own timestamps, so demo click events are inserted
 * directly and then aggregated with the production rollup job.
 *
 * Usage:
 *   pnpm db:seed:demo            (API must be running on API_BASE_URL)
 *   DEMO_ANALYTICS_DAYS=120 pnpm db:seed:demo
 *
 * The owner must exist first (`pnpm db:seed`). Re-running the script is safe:
 * categories are matched by name, links by title, and analytics for the owner
 * are regenerated from scratch.
 */
import "dotenv/config";
import { createHash, randomBytes } from "node:crypto";
import pg from "pg";
import { PrismaClient } from "@prisma/client";
import { rollup } from "../apps/api/src/jobs/analytics-nightly";

const prisma = new PrismaClient();

const API_BASE = (process.env.API_BASE_URL ?? "http://localhost:4000").replace(
  /\/$/,
  "",
);
const APP_ORIGIN = process.env.APP_URL ?? "http://localhost:3000";
const ANALYTICS_DAYS = 90;

if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing to seed demo data when NODE_ENV=production.");
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required to seed demo data.`);
  return value;
}

interface ApiClientOptions {
  baseUrl: string;
  origin: string;
}

class ApiClient {
  private readonly baseUrl: string;
  private readonly origin: string;
  private readonly jar = new Map<string, string>();
  private csrfToken = "";

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.origin = options.origin;
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>(path);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: "POST", body });
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, { method: "PATCH", body });
  }

  async put<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, { method: "PUT", body });
  }

  private async request<T>(
    path: string,
    init: { method?: string; body?: unknown } = {},
  ): Promise<T> {
    const method = init.method ?? "GET";
    const headers = new Headers({ Origin: this.origin });
    if (init.body !== undefined) headers.set("Content-Type", "application/json");
    if (this.csrfToken) headers.set("X-CSRF-Token", this.csrfToken);
    if (this.jar.size > 0) {
      headers.set(
        "Cookie",
        Array.from(this.jar, ([key, value]) => `${key}=${value}`).join("; "),
      );
    }

    const response = await fetch(this.baseUrl + path, {
      method,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });

    for (const raw of response.headers.getSetCookie()) {
      const pair = raw.split(";")[0] ?? "";
      const separator = pair.indexOf("=");
      if (separator > 0) {
        this.jar.set(pair.slice(0, separator), pair.slice(separator + 1));
      }
    }

    const text = await response.text();
    let payload: unknown = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = text;
    }

    const data =
      payload && typeof payload === "object" && "data" in payload
        ? (payload as { data: unknown }).data
        : payload;
    if (
      data &&
      typeof data === "object" &&
      "csrfToken" in data &&
      typeof (data as { csrfToken?: unknown }).csrfToken === "string"
    ) {
      this.csrfToken = (data as { csrfToken: string }).csrfToken;
    }

    if (!response.ok) {
      throw new Error(
        `${method} ${path} -> ${response.status} ${text.slice(0, 400)}`,
      );
    }
    return data as T;
  }
}

interface DemoCategory {
  key: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  isVisible: boolean;
}

interface DemoLink {
  key: string;
  category: string | null;
  type: "link" | "header" | "youtube" | "contact";
  title: string;
  url: string;
  description: string;
  icon: string;
  config?: Record<string, unknown>;
  isActive?: boolean;
  /** Relative click popularity used by the analytics generator. */
  weight: number;
}

interface CategoryDto {
  id: string;
  name: string;
  sortOrder: number;
}

interface LinkDto {
  id: string;
  title: string;
  categoryId: string | null;
  sortOrder: number;
}

const PROFILE = {
  displayName: "Nayan Kunwar",
  headline: "Product engineer building small, fast tools",
  bio: "I design and build developer tools, link-in-bio products, and the occasional weekend experiment. Currently shipping LinkHub from Kathmandu.",
  avatarUrl:
    "https://api.dicebear.com/9.x/notionists/svg?seed=Nayan%20Kunwar&backgroundColor=e9d5ff",
  socials: {
    website: "https://nayankunwar.com",
    github: "https://github.com/nayan-kunwar",
    linkedin: "https://www.linkedin.com/in/nayankunwar",
    x: "https://x.com/nayankunwar",
    medium: "https://medium.com/@nayankunwar",
    email: "mailto:hello@nayankunwar.com",
  },
  appearance: {
    theme: "default",
    color: "#7c3aed",
    background: "gradient",
    card: "soft",
    button: "solid",
    layout: "grouped",
    font: "sans",
    showAvatar: true,
    showBio: true,
    showSocial: true,
    showDescription: true,
  },
};

const CATEGORIES: DemoCategory[] = [
  {
    key: "work",
    name: "Work",
    description: "Day job, clients, and the tools I ship.",
    color: "#7c3aed",
    icon: "briefcase",
    isVisible: true,
  },
  {
    key: "writing",
    name: "Writing",
    description: "Essays, notes, and longer-form thinking.",
    color: "#2563eb",
    icon: "book",
    isVisible: true,
  },
  {
    key: "projects",
    name: "Projects",
    description: "Open source, experiments, and side quests.",
    color: "#059669",
    icon: "code",
    isVisible: true,
  },
  {
    key: "content",
    name: "Content",
    description: "Videos, playlists, and things worth watching.",
    color: "#db2777",
    icon: "camera",
    isVisible: true,
  },
  {
    key: "connect",
    name: "Connect",
    description: "Calls, email, and where else to find me.",
    color: "#0d9488",
    icon: "mail",
    isVisible: true,
  },
  {
    key: "resources",
    name: "Resources",
    description: "Tools, books, and setups I recommend.",
    color: "#d97706",
    icon: "star",
    isVisible: true,
  },
  {
    key: "archive",
    name: "Archive",
    description: "Hidden from the public page.",
    color: "#64748b",
    icon: "archive",
    isVisible: false,
  },
];

const LINKS: DemoLink[] = [
  {
    key: "portfolio",
    category: "work",
    type: "link",
    title: "Portfolio — nayankunwar.com",
    url: "https://nayankunwar.com",
    description: "Design systems, product engineering, and side projects.",
    icon: "globe",
    config: {
      layout: "featured",
      subtitle: "Product engineer · Kathmandu → remote",
      imageUrl: "https://picsum.photos/seed/linkhub-portfolio/1200/630",
    },
    weight: 12,
  },
  {
    key: "resume",
    category: "work",
    type: "link",
    title: "Résumé (PDF)",
    url: "https://nayankunwar.com/resume.pdf",
    description: "Updated November 2026 · one page, no fluff.",
    icon: "file",
    config: { layout: "classic", subtitle: "Product engineer · 8 years" },
    weight: 4,
  },
  {
    key: "intro-call",
    category: "work",
    type: "link",
    title: "Book a 30-minute intro call",
    url: "https://cal.com/nayankunwar/intro",
    description: "Pick any open slot — Cal.com handles the rest.",
    icon: "briefcase",
    config: { layout: "classic", subtitle: "Mon–Fri · 10:00–17:00 CET" },
    weight: 6,
  },
  {
    key: "linkhub-product",
    category: "work",
    type: "link",
    title: "LinkHub — product page",
    url: "https://nayankunwar.com/linkhub",
    description: "The link-in-bio app that powers this page.",
    icon: "link",
    config: {
      layout: "rich",
      subtitle: "Next.js · Express · Prisma · Postgres",
      imageUrl: "https://picsum.photos/seed/linkhub-product/1200/630",
    },
    weight: 7,
  },
  {
    key: "rebuild-post",
    category: "writing",
    type: "link",
    title: "Why I rebuilt my link-in-bio from scratch",
    url: "https://nayan.dev/blog/rebuilding-linkhub",
    description: "A weekend rewrite, and what it taught me.",
    icon: "book",
    config: { layout: "classic", subtitle: "6 min read · November 2026" },
    weight: 7,
  },
  {
    key: "prisma-post",
    category: "writing",
    type: "link",
    title: "Prisma patterns I keep reaching for",
    url: "https://nayan.dev/blog/prisma-patterns",
    description: "Transactions, scoped queries, safe migrations.",
    icon: "book",
    config: { layout: "classic", subtitle: "12 min read · September 2026" },
    weight: 3,
  },
  {
    key: "one-handed-post",
    category: "writing",
    type: "link",
    title: "Designing for one-handed use",
    url: "https://nayan.dev/blog/one-handed-design",
    description: "Thumb zones, tap targets, and mobile forms.",
    icon: "book",
    config: { layout: "classic", subtitle: "9 min read · October 2026" },
    weight: 3,
  },
  {
    key: "blog",
    category: "writing",
    type: "link",
    title: "Blog — nayan.dev",
    url: "https://nayan.dev",
    description: "Long-form posts on product engineering.",
    icon: "globe",
    config: {
      layout: "rich",
      subtitle: "New essays every other week",
      imageUrl: "https://picsum.photos/seed/linkhub-blog/1200/630",
    },
    weight: 9,
  },
  {
    key: "medium",
    category: "writing",
    type: "link",
    title: "Medium archive",
    url: "https://medium.com/@nayankunwar",
    description: "Older writing from 2019 to 2023.",
    icon: "medium",
    weight: 2,
  },
  {
    key: "newsletter",
    category: "writing",
    type: "link",
    title: "The Weekly Build — newsletter",
    url: "https://buttondown.com/nayankunwar",
    description: "One project, one lesson, every Friday.",
    icon: "mail",
    config: { layout: "classic", subtitle: "Free · every Friday" },
    weight: 5,
  },
  {
    key: "linkhub-github",
    category: "projects",
    type: "link",
    title: "LinkHub on GitHub",
    url: "https://github.com/nayan-kunwar/LinkHub",
    description: "Open-source core, TypeScript from end to end.",
    icon: "github",
    config: {
      layout: "rich",
      subtitle: "TypeScript · MIT",
      imageUrl: "https://picsum.photos/seed/linkhub-github/1200/630",
    },
    weight: 10,
  },
  {
    key: "cursor-helpers",
    category: "projects",
    type: "link",
    title: "Prisma cursor helpers",
    url: "https://github.com/nayan-kunwar/prisma-cursor-helpers",
    description: "Keyset pagination without the boilerplate.",
    icon: "code",
    config: { layout: "classic", subtitle: "TypeScript · MIT" },
    weight: 3,
  },
  {
    key: "token-forge",
    category: "projects",
    type: "link",
    title: "Token Forge",
    url: "https://github.com/nayan-kunwar/token-forge",
    description: "Figma tokens to CSS, Tailwind, and Swift.",
    icon: "code",
    config: { layout: "classic", subtitle: "Figma plugin · TypeScript" },
    weight: 2,
  },
  {
    key: "npm",
    category: "projects",
    type: "link",
    title: "npm packages",
    url: "https://www.npmjs.com/~nayankunwar",
    description: "Everything I publish, mostly small utilities.",
    icon: "archive",
    weight: 2,
  },
  {
    key: "figma",
    category: "projects",
    type: "link",
    title: "Figma community files",
    url: "https://www.figma.com/@nayankunwar",
    description: "UI kits and components, free to remix.",
    icon: "star",
    weight: 2,
  },
  {
    key: "dribbble",
    category: "projects",
    type: "link",
    title: "Dribbble — selected shots",
    url: "https://dribbble.com/nayankunwar",
    description: "Visual explorations and UI studies.",
    icon: "heart",
    weight: 2,
  },
  {
    key: "content-header",
    category: "content",
    type: "header",
    title: "Watch & listen",
    url: "",
    description: "",
    icon: "auto",
    config: { subtitle: "Videos, playlists, and builds." },
    weight: 0,
  },
  {
    key: "youtube-channel",
    category: "content",
    type: "link",
    title: "YouTube — Nayan Builds",
    url: "https://www.youtube.com/@nayanbuilds",
    description: "Build logs and teardowns, mostly TypeScript.",
    icon: "youtube",
    config: {
      layout: "rich",
      subtitle: "New video every other week",
      imageUrl: "https://i.ytimg.com/vi/8aGhZQkoFbQ/maxresdefault.jpg",
    },
    weight: 8,
  },
  {
    key: "youtube-eventloop",
    category: "content",
    type: "youtube",
    title: "What the heck is the event loop?",
    url: "https://www.youtube.com/watch?v=8aGhZQkoFbQ",
    description: "Still the best explanation, ten years on.",
    icon: "youtube",
    config: { videoId: "8aGhZQkoFbQ" },
    weight: 3,
  },
  {
    key: "youtube-embed",
    category: "content",
    type: "youtube",
    title: "Embedding YouTube: player customization",
    url: "https://www.youtube.com/watch?v=M7lc1UVf-VE",
    description: "An oldie but a goodie from the YouTube devs.",
    icon: "youtube",
    config: { videoId: "M7lc1UVf-VE" },
    weight: 3,
  },
  {
    key: "spotify",
    category: "content",
    type: "link",
    title: "Spotify — Deep Focus",
    url: "https://open.spotify.com/playlist/37i9dQZF1DWZeKCadgRdKQ",
    description: "The playlist I write to.",
    icon: "spotify",
    weight: 3,
  },
  {
    key: "instagram",
    category: "content",
    type: "link",
    title: "Instagram — @nayankunwar",
    url: "https://www.instagram.com/nayankunwar",
    description: "Travel, coffee, and whiteboards.",
    icon: "instagram",
    weight: 2,
  },
  {
    key: "x",
    category: "content",
    type: "link",
    title: "X — @nayankunwar",
    url: "https://x.com/nayankunwar",
    description: "Build in public, mostly.",
    icon: "x",
    weight: 5,
  },
  {
    key: "contact",
    category: "connect",
    type: "contact",
    title: "Say hello",
    url: "",
    description: "Email, call, or WhatsApp — whatever is easiest.",
    icon: "mail",
    config: {
      email: "hello@nayankunwar.com",
      phone: "+977 980 123 4567",
      whatsapp: "+977 980 123 4567",
    },
    weight: 2,
  },
  {
    key: "linkedin",
    category: "connect",
    type: "link",
    title: "LinkedIn",
    url: "https://www.linkedin.com/in/nayankunwar",
    description: "Work history and recommendations.",
    icon: "linkedin",
    weight: 4,
  },
  {
    key: "github",
    category: "connect",
    type: "link",
    title: "GitHub",
    url: "https://github.com/nayan-kunwar",
    description: "Code, experiments, and half-finished ideas.",
    icon: "github",
    weight: 4,
  },
  {
    key: "coffee-chat",
    category: "connect",
    type: "link",
    title: "Cal.com — 15-minute coffee chat",
    url: "https://cal.com/nayankunwar/coffee",
    description: "For quick questions and hellos.",
    icon: "link",
    weight: 2,
  },
  {
    key: "resources-header",
    category: "resources",
    type: "header",
    title: "Reading & tools",
    url: "",
    description: "",
    icon: "auto",
    config: { subtitle: "What keeps me sharp." },
    weight: 0,
  },
  {
    key: "uses",
    category: "resources",
    type: "link",
    title: "Uses — my dev setup",
    url: "https://nayankunwar.com/uses",
    description: "Hardware, editor, and the apps I run daily.",
    icon: "star",
    weight: 2,
  },
  {
    key: "goodreads",
    category: "resources",
    type: "link",
    title: "Reading list on Goodreads",
    url: "https://www.goodreads.com/nayankunwar",
    description: "What I'm reading and what I recommend.",
    icon: "book",
    weight: 2,
  },
  {
    key: "notion-resources",
    category: "resources",
    type: "link",
    title: "Design resources on Notion",
    url: "https://nayankunwar.notion.site/design-resources",
    description: "Typography, color, and layout references.",
    icon: "archive",
    weight: 1,
  },
  {
    key: "newsletter-archive",
    category: "resources",
    type: "link",
    title: "Newsletter archive",
    url: "https://buttondown.com/nayankunwar/archive",
    description: "Every issue, searchable.",
    icon: "file",
    weight: 1,
  },
  {
    key: "old-portfolio",
    category: "archive",
    type: "link",
    title: "Old portfolio (v1)",
    url: "https://v1.nayankunwar.com",
    description: "Kept for the archive — no longer maintained.",
    icon: "archive",
    isActive: false,
    weight: 1,
  },
  {
    key: "legacy-blog",
    category: "archive",
    type: "link",
    title: "Legacy blog (2019–2022)",
    url: "https://blog.nayankunwar.com",
    description: "Old WordPress blog, still online.",
    icon: "book",
    weight: 1,
  },
  {
    key: "other-header",
    category: null,
    type: "header",
    title: "Elsewhere",
    url: "",
    description: "",
    icon: "auto",
    config: { subtitle: "A few extras for the curious." },
    weight: 0,
  },
  {
    key: "coffee",
    category: null,
    type: "link",
    title: "Buy me a coffee",
    url: "https://buymeacoffee.com/nayankunwar",
    description: "Support the weekend projects.",
    icon: "heart",
    weight: 2,
  },
];

const COUNTRY_WEIGHTS: Array<[string, number]> = [
  ["US", 26],
  ["IN", 18],
  ["GB", 9],
  ["DE", 7],
  ["CA", 6],
  ["AU", 4],
  ["NL", 4],
  ["SG", 3],
  ["BR", 3],
  ["JP", 3],
  ["FR", 2],
  ["ES", 2],
  ["NP", 5],
  ["SE", 1],
  ["PL", 1],
  ["ZA", 1],
  ["AE", 1],
  ["KR", 1],
];

const DEVICE_WEIGHTS: Array<[string, number]> = [
  ["mobile", 58],
  ["desktop", 34],
  ["tablet", 8],
];

const REFERRER_WEIGHTS: Array<[string | null, number]> = [
  [null, 31],
  ["x.com", 15],
  ["linkedin.com", 12],
  ["github.com", 10],
  ["google.com", 10],
  ["news.ycombinator.com", 5],
  ["youtube.com", 4],
  ["instagram.com", 3],
  ["reddit.com", 2],
  ["producthunt.com", 2],
  ["nayan.dev", 2],
  ["mail.google.com", 2],
  ["bsky.app", 2],
];

function pick<T>(weighted: Array<[T, number]>): T {
  const total = weighted.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = Math.random() * total;
  for (const [value, weight] of weighted) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return weighted[weighted.length - 1][0];
}

function utcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function seedContent(api: ApiClient, userId: string) {
  console.log("updating profile and appearance…");
  await api.patch("/api/v1/profile", PROFILE);
  await api.post("/api/v1/profile/publish");

  console.log("upserting categories…");
  const existingCategories = await api.get<CategoryDto[]>("/api/v1/categories");
  const categoryIdByName = new Map<string, string>();
  for (const category of existingCategories) {
    categoryIdByName.set(category.name, category.id);
  }

  for (const category of CATEGORIES) {
    const body = {
      name: category.name,
      description: category.description,
      color: category.color,
      icon: category.icon,
      isVisible: category.isVisible,
    };
    const existingId = categoryIdByName.get(category.name);
    if (existingId) {
      await api.patch(`/api/v1/categories/${existingId}`, body);
    } else {
      const created = await api.post<CategoryDto>("/api/v1/categories", body);
      categoryIdByName.set(category.name, created.id);
    }
  }

  console.log("upserting links…");
  const existingLinks = await api.get<LinkDto[]>("/api/v1/links");
  const linkIdByTitle = new Map<string, string>();
  for (const link of existingLinks) linkIdByTitle.set(link.title, link.id);

  const linkIdByKey = new Map<string, string>();
  for (const link of LINKS) {
    const categoryId = link.category
      ? (categoryIdByName.get(
          CATEGORIES.find((item) => item.key === link.category)!.name,
        ) ?? null)
      : null;
    const body = {
      title: link.title,
      url: link.url,
      description: link.description,
      categoryId,
      icon: link.icon,
      isActive: link.isActive ?? true,
      config: link.config,
    };
    const existingId = linkIdByTitle.get(link.title);
    if (existingId) {
      await api.patch(`/api/v1/links/${existingId}`, body);
      linkIdByKey.set(link.key, existingId);
    } else {
      const created = await api.post<LinkDto>("/api/v1/links", {
        ...body,
        type: link.type,
      });
      linkIdByKey.set(link.key, created.id);
    }
  }

  console.log("reordering categories and links…");
  const freshCategories = await api.get<CategoryDto[]>("/api/v1/categories");
  const demoCategoryIds = new Set(
    CATEGORIES.map((category) => categoryIdByName.get(category.name)!),
  );
  const orderedCategoryIds = [
    ...CATEGORIES.map((category) => categoryIdByName.get(category.name)!),
    ...freshCategories
      .filter((category) => !demoCategoryIds.has(category.id))
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((category) => category.id),
  ];
  await api.put("/api/v1/categories/reorder", { ids: orderedCategoryIds });

  const freshLinks = await api.get<LinkDto[]>("/api/v1/links");
  const demoLinkIds = new Set(linkIdByKey.values());
  const scopes: Array<{ categoryId: string | null; label: string }> = [
    ...CATEGORIES.map((category) => ({
      categoryId: categoryIdByName.get(category.name)!,
      label: category.name,
    })),
    { categoryId: null, label: "uncategorised" },
  ];

  for (const scope of scopes) {
    const linksInScope = freshLinks.filter(
      (link) => (link.categoryId ?? null) === scope.categoryId,
    );
    if (linksInScope.length === 0) continue;

    const demoLinksInScope = LINKS.filter((link) => {
      const categoryName = link.category
        ? CATEGORIES.find((category) => category.key === link.category)?.name
        : null;
      const categoryId = categoryName
        ? (categoryIdByName.get(categoryName) ?? null)
        : null;
      return categoryId === scope.categoryId;
    });
    const orderedLinkIds = [
      ...demoLinksInScope.map((link) => linkIdByKey.get(link.key)!),
      ...linksInScope
        .filter((link) => !demoLinkIds.has(link.id))
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((link) => link.id),
    ];
    await api.put("/api/v1/links/reorder", {
      ids: orderedLinkIds,
      categoryId: scope.categoryId,
    });
  }

  console.log(`content ready for owner ${userId}`);
  return { linkIdByKey };
}

async function seedAnalytics(userId: string, linkIdByKey: Map<string, string>) {
  console.log(`regenerating ${ANALYTICS_DAYS} days of click analytics…`);
  await prisma.$transaction([
    prisma.clickEvent.deleteMany({ where: { userId } }),
    prisma.clickDailyStat.deleteMany({ where: { userId } }),
    prisma.clickDailyBreakdown.deleteMany({ where: { userId } }),
  ]);

  const clickable = LINKS.filter((link) => link.type !== "header").map(
    (link) => ({
      key: link.key,
      id: linkIdByKey.get(link.key)!,
      weight: link.weight,
    }),
  );

  const today = utcDay(new Date());
  const startDay = addDays(today, -(ANALYTICS_DAYS - 1));
  const rows: Array<{
    linkId: string;
    userId: string;
    clickedAt: Date;
    referrerHost: string | null;
    deviceType: string | null;
    countryCode: string | null;
    visitorHash: string;
  }> = [];

  for (let offset = 0; offset < ANALYTICS_DAYS; offset += 1) {
    const day = addDays(startDay, offset);
    const weekday = day.getUTCDay();
    const weekdayFactor =
      weekday === 0 ? 0.62 : weekday === 6 ? 0.7 : weekday === 5 ? 0.92 : 1;
    const trend = 0.72 + 0.5 * (offset / (ANALYTICS_DAYS - 1));
    const spike =
      offset === 44 ? 1.9 : offset === 71 ? 1.45 : offset === 12 ? 1.3 : 1;
    const noise = 0.82 + Math.random() * 0.36;
    const dayClicks = Math.round(
      46 * weekdayFactor * trend * spike * noise,
    );

    const weights = clickable
      .map((link): [typeof link, number] => {
        if (link.key === "old-portfolio") {
          return [link, offset < 30 ? link.weight : 0];
        }
        if (link.key === "legacy-blog") return [link, link.weight * 0.4];
        return [link, link.weight];
      })
      .filter(([, weight]) => weight > 0);

    const counts = new Map<string, number>();
    for (let click = 0; click < dayClicks; click += 1) {
      const link = pick(weights);
      counts.set(link.id, (counts.get(link.id) ?? 0) + 1);
    }

    for (const [linkId, count] of counts) {
      const uniqueRatio = count <= 2 ? 1 : 0.5 + Math.random() * 0.28;
      const uniqueTarget = Math.max(1, Math.round(count * uniqueRatio));
      const seeds = Array.from({ length: uniqueTarget }, () =>
        randomBytes(8).toString("hex"),
      );
      const hashes = Array.from({ length: count }, (_, index) =>
        createHash("sha256")
          .update(`${seeds[index % uniqueTarget]}:${linkId}:${dayKey(day)}`)
          .digest("hex")
          .slice(0, 32),
      );
      for (let index = hashes.length - 1; index > 0; index -= 1) {
        const swap = Math.floor(Math.random() * (index + 1));
        [hashes[index], hashes[swap]] = [hashes[swap], hashes[index]];
      }

      for (let index = 0; index < count; index += 1) {
        const hour =
          Math.random() < 0.08
            ? Math.floor(Math.random() * 7)
            : 8 + Math.floor(Math.random() * 15);
        const clickedAt = new Date(day);
        clickedAt.setUTCHours(
          hour,
          Math.floor(Math.random() * 60),
          Math.floor(Math.random() * 60),
          0,
        );

        rows.push({
          linkId,
          userId,
          clickedAt,
          referrerHost: pick(REFERRER_WEIGHTS),
          deviceType:
            Math.random() < 0.02 ? null : pick(DEVICE_WEIGHTS),
          countryCode:
            Math.random() < 0.04 ? null : pick(COUNTRY_WEIGHTS),
          visitorHash: hashes[index],
        });
      }
    }
  }

  for (let index = 0; index < rows.length; index += 1000) {
    await prisma.clickEvent.createMany({
      data: rows.slice(index, index + 1000),
    });
  }

  const connectionString =
    process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL or DIRECT_URL is required for the rollup.");
  }
  const client = new pg.Client({
    connectionString,
    application_name: "linkhub-seed-demo",
  });
  await client.connect();
  let rolled: Awaited<ReturnType<typeof rollup>>;
  try {
    rolled = await rollup(client, {
      from: startDay,
      through: addDays(today, -1),
      updateWatermark: true,
    });
  } finally {
    await client.end();
  }

  return { events: rows.length, rolled };
}

async function main() {
  const email = requireEnv("SEED_OWNER_EMAIL").trim().toLowerCase();
  requireEnv("SEED_OWNER_PASSWORD");

  const owner = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });
  if (!owner) {
    throw new Error(
      `No owner found for ${email}. Run "pnpm db:seed" first.`,
    );
  }

  const api = new ApiClient({ baseUrl: API_BASE, origin: APP_ORIGIN });
  console.log(`signing in through the API at ${API_BASE}…`);
  await api.get("/api/v1/auth/csrf");
  await api.post("/api/v1/auth/login", {
    email,
    password: requireEnv("SEED_OWNER_PASSWORD"),
    remember: true,
  });

  const profile = await api.get<{ username: string }>("/api/v1/profile");
  console.log(`signed in as ${profile.username}`);

  const { linkIdByKey } = await seedContent(api, owner.id);
  const { events, rolled } = await seedAnalytics(owner.id, linkIdByKey);

  const [stat, breakdown, device] = await Promise.all([
    prisma.clickDailyStat.aggregate({
      where: { userId: owner.id },
      _sum: { count: true, uniqueCount: true },
    }),
    prisma.clickDailyBreakdown.count({ where: { userId: owner.id } }),
    prisma.clickEvent.groupBy({
      by: ["deviceType"],
      where: { userId: owner.id },
      _count: true,
    }),
  ]);

  console.log(
    [
      "",
      "Demo data ready:",
      `  categories: ${CATEGORIES.length}`,
      `  links: ${LINKS.length} (${LINKS.filter((link) => link.isActive !== false).length} active)`,
      `  click events: ${events}`,
      `  rolled clicks: ${stat._sum.count ?? 0}`,
      `  rolled uniques: ${stat._sum.uniqueCount ?? 0}`,
      `  rollup days: ${rolled.days} (watermark ${rolled.watermark})`,
      `  breakdown rows: ${breakdown}`,
      `  device events: ${device.map((row) => `${row.deviceType ?? "unknown"}=${row._count}`).join(", ")}`,
      "",
    ].join("\n"),
  );
}

main()
  .catch((error) => {
    console.error("DEMO SEED FAILED:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
