import type { Plan, Prisma } from "@prisma/client";
import { prisma } from "../../lib/db";
import { categoryDto } from "../../lib/dto";
import { assertWithinLimit } from "../../lib/entitlements";
import { fail } from "../../lib/errors";
import { revalidateProfile } from "../../lib/revalidate";
import { scoped } from "../../lib/tenant";
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from "./categories.schema";

async function revalidateOwner(userId: string): Promise<void> {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { username: true },
  });
  if (profile) await revalidateProfile(profile.username);
}

export async function listCategories(userId: string) {
  const categories = await scoped(userId).categories.list();
  return categories.map(categoryDto);
}

export async function getCategory(userId: string, id: string) {
  const category = await scoped(userId).categories.get(id);
  if (!category) throw fail.notFound();
  return categoryDto(category);
}

export async function createCategory(
  userId: string,
  plan: Plan,
  input: CreateCategoryInput,
) {
  const category = await prisma.$transaction(async (tx) => {
    await assertWithinLimit(tx, userId, "categories", plan);
    const max = await tx.category.aggregate({
      where: { userId, deletedAt: null },
      _max: { sortOrder: true },
    });
    return tx.category.create({
      data: {
        userId,
        name: input.name,
        description: input.description,
        color: input.color,
        icon: input.icon,
        isVisible: input.isVisible,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
    });
  });

  await revalidateOwner(userId);
  return categoryDto(category);
}

export async function updateCategory(
  userId: string,
  id: string,
  input: UpdateCategoryInput,
) {
  const current = await scoped(userId).categories.get(id);
  if (!current) throw fail.notFound();

  const data: Prisma.CategoryUpdateManyMutationInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.color !== undefined) data.color = input.color;
  if (input.icon !== undefined) data.icon = input.icon;
  if (input.isVisible !== undefined) data.isVisible = input.isVisible;

  const result = await prisma.category.updateMany({
    where: { id, userId, deletedAt: null },
    data,
  });
  if (result.count === 0) throw fail.notFound();

  const updated = await scoped(userId).categories.get(id);
  if (!updated) throw fail.notFound();
  await revalidateOwner(userId);
  return categoryDto(updated);
}

export async function deleteCategory(userId: string, id: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const category = await tx.category.findFirst({
      where: { id, userId, deletedAt: null },
      select: { id: true },
    });
    if (!category) throw fail.notFound();

    await tx.link.updateMany({
      where: { userId, categoryId: id, deletedAt: null },
      data: { categoryId: null },
    });
    await tx.category.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  });

  await revalidateOwner(userId);
}

export async function reorderCategories(userId: string, ids: string[]): Promise<void> {
  if (new Set(ids).size !== ids.length) {
    throw fail.validation("Each category can appear only once in a reorder.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM categories WHERE user_id = ${userId}::uuid AND deleted_at IS NULL FOR UPDATE`;
    const categories = await tx.category.findMany({
      where: { userId, deletedAt: null },
      select: { id: true },
    });

    const scope = new Set(categories.map((category) => category.id));
    if (ids.some((id) => !scope.has(id))) throw fail.notFound();
    if (ids.length !== categories.length) {
      throw fail.validation("Reorder must include every category.");
    }

    for (let index = 0; index < ids.length; index += 1) {
      await tx.category.updateMany({
        where: { id: ids[index], userId, deletedAt: null },
        data: { sortOrder: index },
      });
    }
  });

  await revalidateOwner(userId);
}
