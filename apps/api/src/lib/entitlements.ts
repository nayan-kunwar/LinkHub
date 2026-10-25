import type { Plan, Prisma } from "@prisma/client";
import { fail } from "./errors";

export const PLANS = {
  free: {
    maxLinks: 50,
    maxCategories: 20,
    rawEventRetentionDays: 90,
    analyticsHistoryDays: 365,
    exportEnabled: true,
  },
} as const;

export type PlanId = keyof typeof PLANS;

export function entitlementsFor(plan: Plan | PlanId) {
  return PLANS[plan as PlanId] ?? PLANS.free;
}

export type LimitKind = "links" | "categories";

/**
 * Count + insert must be serialized per user. Callers run this inside the same
 * transaction as the insert, after the user row has been locked.
 */
export async function assertWithinLimit(
  tx: Prisma.TransactionClient,
  userId: string,
  kind: LimitKind,
  plan: Plan | PlanId = "free",
): Promise<void> {
  const limits = entitlementsFor(plan);
  const max = kind === "links" ? limits.maxLinks : limits.maxCategories;

  // Lock the owning user row for the duration of the transaction. The raw
  // query is safe: the UUID is bound as a parameter.
  await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;

  const count =
    kind === "links"
      ? await tx.link.count({ where: { userId, deletedAt: null } })
      : await tx.category.count({ where: { userId, deletedAt: null } });

  if (count >= max) {
    throw fail.limitReached(
      kind === "links"
        ? `You can have up to ${max} links on the free plan.`
        : `You can have up to ${max} categories on the free plan.`,
    );
  }
}
