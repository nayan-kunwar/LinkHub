import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

/**
 * Every owned-resource query goes through this helper. `userId` must come from
 * the session, never from a request body or query string.
 */
export const scoped = (userId: string) => ({
  links: {
    list: (where: Prisma.LinkWhereInput = {}) =>
      prisma.link.findMany({
        where: { ...where, userId, deletedAt: null },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      }),
    get: (id: string) =>
      prisma.link.findFirst({ where: { id, userId, deletedAt: null } }),
    update: (id: string, data: Prisma.LinkUncheckedUpdateManyInput) =>
      prisma.link.updateMany({ where: { id, userId, deletedAt: null }, data }),
    count: () => prisma.link.count({ where: { userId, deletedAt: null } }),
  },
  categories: {
    list: () =>
      prisma.category.findMany({
        where: { userId, deletedAt: null },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          _count: {
            select: { links: { where: { deletedAt: null } } },
          },
        },
      }),
    get: (id: string) =>
      prisma.category.findFirst({ where: { id, userId, deletedAt: null } }),
    count: () => prisma.category.count({ where: { userId, deletedAt: null } }),
  },
  profile: {
    get: () => prisma.profile.findUnique({ where: { userId } }),
  },
});
