import type { Plan, Prisma } from "@prisma/client";
import {
  isLinkType,
  linkConfigSchemas,
  parseYouTubeId,
  type LinkType,
} from "@linkhub/shared";
import { prisma } from "../../lib/db";
import { linkDto } from "../../lib/dto";
import { assertWithinLimit } from "../../lib/entitlements";
import { fail } from "../../lib/errors";
import { revalidateProfile } from "../../lib/revalidate";
import { scoped } from "../../lib/tenant";
import type {
  CreateLinkInput,
  ListLinksQuery,
  UpdateLinkInput,
} from "./links.schema";

/** Validates and normalises config for a type. Throws a 400 with field paths. */
function normaliseConfig(
  type: LinkType,
  url: string,
  raw: unknown,
): Prisma.InputJsonValue {
  let input = raw;
  if (type === "youtube") {
    const videoId = parseYouTubeId(url);
    if (!videoId) {
      throw fail.validation("Paste a YouTube video link.", [
        { path: "url", message: "Paste a YouTube video link." },
      ]);
    }
    // Server-derived; never trust the client's videoId.
    input = { videoId };
  }

  const parsed = linkConfigSchemas[type].safeParse(input ?? {});
  if (!parsed.success) {
    throw fail.validation(
      "Some block settings are invalid.",
      parsed.error.issues.map((issue) => ({
        path: ["config", ...issue.path].join("."),
        message: issue.message,
      })),
    );
  }
  return parsed.data as Prisma.InputJsonValue;
}

async function revalidateOwner(userId: string): Promise<void> {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { username: true },
  });
  if (profile) await revalidateProfile(profile.username);
}

export async function listLinks(userId: string, query: ListLinksQuery) {
  const where: Prisma.LinkWhereInput = {};
  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: "insensitive" } },
      { url: { contains: query.search, mode: "insensitive" } },
      { description: { contains: query.search, mode: "insensitive" } },
    ];
  }
  if (query.categoryId) where.categoryId = query.categoryId;
  if (query.status === "active") where.isActive = true;
  if (query.status === "inactive") where.isActive = false;

  const links = await scoped(userId).links.list(where);
  return links.map(linkDto);
}

export async function getLink(userId: string, id: string) {
  const link = await scoped(userId).links.get(id);
  if (!link) throw fail.notFound();
  return linkDto(link);
}

export async function createLink(
  userId: string,
  plan: Plan,
  input: CreateLinkInput,
) {
  const link = await prisma.$transaction(async (tx) => {
    await assertWithinLimit(tx, userId, "links", plan);

    if (input.categoryId) {
      const category = await tx.category.findFirst({
        where: { id: input.categoryId, userId, deletedAt: null },
        select: { id: true },
      });
      if (!category) throw fail.notFound();
    }

    const max = await tx.link.aggregate({
      where: { userId, deletedAt: null },
      _max: { sortOrder: true },
    });

    return tx.link.create({
      data: {
        userId,
        title: input.title,
        url: input.url,
        type: input.type,
        config: normaliseConfig(input.type, input.url, input.config),
        description: input.description,
        categoryId: input.categoryId,
        icon: input.icon,
        isActive: input.isActive,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
    });
  });

  await revalidateOwner(userId);
  return linkDto(link);
}

export async function updateLink(
  userId: string,
  id: string,
  input: UpdateLinkInput,
) {
  const current = await scoped(userId).links.get(id);
  if (!current) throw fail.notFound();

  if (input.categoryId !== undefined && input.categoryId !== null) {
    const category = await prisma.category.findFirst({
      where: { id: input.categoryId, userId, deletedAt: null },
      select: { id: true },
    });
    if (!category) throw fail.notFound();
  }

  const type: LinkType = isLinkType(current.type) ? current.type : "link";

  const data: Prisma.LinkUncheckedUpdateManyInput = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.url !== undefined) {
    data.url = type === "link" || type === "youtube" ? input.url : "";
  }
  if (input.description !== undefined) data.description = input.description;
  if (input.categoryId !== undefined) data.categoryId = input.categoryId;
  if (input.icon !== undefined) data.icon = input.icon;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (input.config !== undefined || input.url !== undefined) {
    const nextUrl =
      typeof data.url === "string" ? data.url : current.url;
    data.config = normaliseConfig(
      type,
      nextUrl,
      input.config ?? current.config,
    );
  }

  const result = await scoped(userId).links.update(id, data);
  if (result.count === 0) throw fail.notFound();

  const updated = await scoped(userId).links.get(id);
  if (!updated) throw fail.notFound();
  await revalidateOwner(userId);
  return linkDto(updated);
}

export async function deleteLink(userId: string, id: string): Promise<void> {
  const result = await scoped(userId).links.update(id, { deletedAt: new Date() });
  if (result.count === 0) throw fail.notFound();
  await revalidateOwner(userId);
}

export async function setLinkStatus(
  userId: string,
  id: string,
  isActive: boolean,
) {
  const result = await scoped(userId).links.update(id, { isActive });
  if (result.count === 0) throw fail.notFound();
  const updated = await scoped(userId).links.get(id);
  if (!updated) throw fail.notFound();
  await revalidateOwner(userId);
  return linkDto(updated);
}

export async function reorderLinks(
  userId: string,
  ids: string[],
  categoryId: string | null | undefined,
): Promise<void> {
  if (new Set(ids).size !== ids.length) {
    throw fail.validation("Each link can appear only once in a reorder.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM links WHERE user_id = ${userId}::uuid AND deleted_at IS NULL FOR UPDATE`;

    const scopeWhere: Prisma.LinkWhereInput =
      categoryId === undefined ? {} : { categoryId };
    const links = await tx.link.findMany({
      where: { ...scopeWhere, userId, deletedAt: null },
      select: { id: true },
    });

    const scope = new Set(links.map((link) => link.id));
    const outsideScope = ids.some((id) => !scope.has(id));
    if (outsideScope) throw fail.notFound();
    if (ids.length !== links.length) {
      throw fail.validation("Reorder must include every link in this scope.");
    }

    for (let index = 0; index < ids.length; index += 1) {
      await tx.link.updateMany({
        where: { id: ids[index], userId, deletedAt: null },
        data: { sortOrder: index },
      });
    }
  });

  await revalidateOwner(userId);
}
