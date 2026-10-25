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
        user: { status: "active", deletedAt: null },
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
