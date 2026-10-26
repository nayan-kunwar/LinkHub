import { Router } from "express";
import { prisma } from "../../lib/db";
import { publicProfileDto } from "../../lib/dto";
import { fail } from "../../lib/errors";
import { sendData } from "../../lib/http";
import {
  availabilityLimiter,
  publicProfileLimiter,
} from "../../middleware/rateLimit";
import { checkUsernameAvailability } from "../profile/profile.service";

export const publicRouter = Router();

publicRouter.get(
  "/public/profiles/:username",
  publicProfileLimiter,
  async (req, res) => {
    const username = String(req.params.username ?? "").trim().toLowerCase();
    if (!username) throw fail.notFound();

    const profile = await prisma.profile.findFirst({
      where: {
        username,
        isPublished: true,
        user: { status: "active", deletedAt: null, deletionScheduledFor: null },
      },
    });
    if (!profile) throw fail.notFound();

    const categories = await prisma.category.findMany({
      where: { userId: profile.userId, deletedAt: null, isVisible: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    const visibleCategoryIds = categories.map((category) => category.id);

    const links = await prisma.link.findMany({
      where: {
        userId: profile.userId,
        deletedAt: null,
        isActive: true,
        OR: [
          { categoryId: null },
          ...(visibleCategoryIds.length > 0
            ? [{ categoryId: { in: visibleCategoryIds } }]
            : []),
        ],
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    res.setHeader(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=60",
    );
    sendData(res, publicProfileDto(profile, categories, links));
  },
);

// Sitemap feed: only published profiles whose owners are active and not
// scheduled for deletion. Kept deliberately small so the web sitemap can be
// regenerated without exposing profile content.
publicRouter.get(
  "/public/profiles",
  publicProfileLimiter,
  async (_req, res) => {
    const profiles = await prisma.profile.findMany({
      where: {
        isPublished: true,
        user: { status: "active", deletedAt: null, deletionScheduledFor: null },
      },
      select: { username: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 5_000,
    });

    res.setHeader(
      "Cache-Control",
      "public, s-maxage=3600, stale-while-revalidate=300",
    );
    sendData(
      res,
      profiles.map((profile) => ({
        username: profile.username,
        updatedAt: profile.updatedAt.toISOString(),
      })),
    );
  },
);

publicRouter.get(
  "/usernames/:username/availability",
  availabilityLimiter,
  async (req, res) => {
    const username = String(req.params.username ?? "");
    const result = await checkUsernameAvailability(username);
    res.setHeader("Cache-Control", "no-store");
    sendData(res, result);
  },
);
