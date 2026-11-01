import { createHmac } from "node:crypto";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { ownerEmail } from "./env";

export const FIXTURE_FILE = path.resolve(
  process.cwd(),
  "e2e",
  ".fixtures.json",
);
export const TITLE_PREFIX = "E2E ";

export const IMAGES = {
  manual: "https://images.example.test/manual.png",
  preview: "https://images.example.test/preview.png",
  ignored: "https://images.example.test/ignored.png",
  article: "https://images.example.test/article.png",
  second: "https://images.example.test/second.png",
} as const;

export interface E2EFixtures {
  username: string;
  links: {
    manual: string;
    preview: string;
    optOut: string;
    youtube: string;
  };
}

function metadata(sourceUrl: string, imageUrl: string) {
  return {
    sourceUrl,
    finalUrl: sourceUrl,
    title: "E2E seeded preview",
    description: "Seeded by the Playwright suite.",
    imageUrl,
    siteName: "Example",
    fetchedAt: "2026-01-01T00:00:00.000Z",
  };
}

/**
 * Seeds read-only public cards directly with Prisma. The E2E API runs with
 * METADATA_FETCH_ENABLED=false, so these fixtures are the only way to exercise
 * stored preview images without outbound network calls.
 */
export async function seedFixtures(): Promise<void> {
  const prisma = new PrismaClient();
  const email = ownerEmail();

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });
    if (!user) {
      throw new Error(
        `No user found for ${email}. Run "pnpm db:seed" before the E2E suite.`,
      );
    }
    if (!user.profile) {
      throw new Error(`User ${email} has no profile. Run "pnpm db:seed".`);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        status: "active",
        emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
        deletionScheduledFor: null,
        deletedAt: null,
      },
    });
    await prisma.profile.update({
      where: { userId: user.id },
      data: { isPublished: true },
    });

    // Remove leftovers from an interrupted previous run.
    await prisma.link.deleteMany({
      where: { userId: user.id, title: { startsWith: TITLE_PREFIX } },
    });

    const common = {
      userId: user.id,
      description: "Seeded by the Playwright E2E suite.",
      icon: "auto",
      isActive: true,
    } satisfies Omit<Prisma.LinkUncheckedCreateInput, "title" | "url" | "type">;

    const [manual, preview, optOut, youtube] = await prisma.$transaction([
      prisma.link.create({
        data: {
          ...common,
          title: "E2E manual image card",
          url: "https://example.com/manual",
          type: "link",
          sortOrder: 0,
          config: {
            layout: "rich",
            subtitle: "Manual image",
            imageUrl: IMAGES.manual,
            usePreviewImage: true,
          },
          metadata: {},
        },
      }),
      prisma.link.create({
        data: {
          ...common,
          title: "E2E preview image card",
          url: "https://example.com/preview",
          type: "link",
          sortOrder: 1,
          config: {
            layout: "featured",
            subtitle: "Stored preview",
            imageUrl: "",
            usePreviewImage: true,
          },
          metadata: metadata("https://example.com/preview", IMAGES.preview),
        },
      }),
      prisma.link.create({
        data: {
          ...common,
          title: "E2E preview opt-out card",
          url: "https://example.com/opt-out",
          type: "link",
          sortOrder: 2,
          config: {
            layout: "rich",
            subtitle: "Opted out",
            imageUrl: "",
            usePreviewImage: false,
          },
          metadata: metadata("https://example.com/opt-out", IMAGES.ignored),
        },
      }),
      prisma.link.create({
        data: {
          ...common,
          title: "E2E YouTube card",
          url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          type: "youtube",
          sortOrder: 3,
          config: { videoId: "dQw4w9WgXcQ" },
          metadata: {},
        },
      }),
    ]);

    const fixtures: E2EFixtures = {
      username: user.profile.username,
      links: {
        manual: manual.id,
        preview: preview.id,
        optOut: optOut.id,
        youtube: youtube.id,
      },
    };
    writeFileSync(FIXTURE_FILE, JSON.stringify(fixtures, null, 2), "utf8");
    console.log(
      `E2E fixtures seeded for ${user.profile.username} (${FIXTURE_FILE}).`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Fixtures are written directly with Prisma, bypassing the API's normal
 * revalidation. Purge the public profile tag so the built web server cannot
 * serve a stale ISR payload left over from an earlier run.
 */
export async function revalidateProfileCache(username: string): Promise<void> {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    throw new Error(
      "REVALIDATE_SECRET is required to revalidate the E2E public profile cache.",
    );
  }

  const body = JSON.stringify({ tags: [`profile:${username}`] });
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");

  const response = await fetch("http://localhost:3100/internal/revalidate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-revalidate-timestamp": timestamp,
      "x-revalidate-signature": signature,
    },
    body,
  });

  if (response.status !== 204) {
    throw new Error(
      `E2E profile revalidation failed with ${response.status}: ${await response.text()}`,
    );
  }
}

export function readFixtures(): E2EFixtures {
  if (!existsSync(FIXTURE_FILE)) {
    throw new Error(
      `Missing ${FIXTURE_FILE}. The Playwright global setup did not run.`,
    );
  }
  return JSON.parse(readFileSync(FIXTURE_FILE, "utf8")) as E2EFixtures;
}

export async function cleanupFixtures(): Promise<void> {
  const prisma = new PrismaClient();

  try {
    const user = await prisma.user.findUnique({
      where: { email: ownerEmail() },
      select: { id: true },
    });
    if (user) {
      const removed = await prisma.link.deleteMany({
        where: { userId: user.id, title: { startsWith: TITLE_PREFIX } },
      });
      console.log(`E2E cleanup removed ${removed.count} fixture link(s).`);
    }
  } finally {
    await prisma.$disconnect();
    if (existsSync(FIXTURE_FILE)) rmSync(FIXTURE_FILE);
  }
}
