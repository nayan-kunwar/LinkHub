import { Prisma, PrismaClient } from "@prisma/client";
import { usernameSchema } from "@linkhub/shared";
import { env } from "../apps/api/src/config/env";
import { DEFAULT_APPEARANCE } from "../apps/api/src/lib/dto";
import { hashPassword } from "../apps/api/src/lib/password";

const prisma = new PrismaClient();

async function seedOwner(): Promise<void> {
  if (!env.SEED_OWNER_EMAIL || !env.SEED_OWNER_PASSWORD) {
    throw new Error(
      "SEED_OWNER_EMAIL and SEED_OWNER_PASSWORD are required to seed the owner.",
    );
  }

  const email = env.SEED_OWNER_EMAIL.trim().toLowerCase();
  const username = usernameSchema.parse(env.DEFAULT_USERNAME);
  const displayName = env.SEED_OWNER_NAME;
  const passwordHash = await hashPassword(env.SEED_OWNER_PASSWORD);

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          role: "owner",
          status: "active",
          emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
          deletionScheduledFor: null,
          deletedAt: null,
        },
      });

      const profile = await tx.profile.findUnique({
        where: { userId: user.id },
      });

      if (profile) {
        await tx.profile.update({
          where: { userId: user.id },
          data: { isPublished: true },
        });
        return;
      }

      const usernameOwner = await tx.profile.findUnique({
        where: { username },
        select: { userId: true },
      });
      if (usernameOwner) {
        throw new Error(
          `DEFAULT_USERNAME "${username}" is already used by another account.`,
        );
      }

      await tx.profile.create({
        data: {
          userId: user.id,
          username,
          displayName,
          theme: DEFAULT_APPEARANCE as unknown as Prisma.InputJsonValue,
          socials: {},
          isPublished: true,
        },
      });
    });

    console.log(`Updated owner ${email} (${username}).`);
    return;
  }

  const usernameOwner = await prisma.profile.findUnique({
    where: { username },
    select: { userId: true },
  });
  if (usernameOwner) {
    throw new Error(
      `DEFAULT_USERNAME "${username}" is already used by another account.`,
    );
  }

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        passwordHash,
        role: "owner",
        status: "active",
        emailVerifiedAt: new Date(),
      },
    });
    await tx.profile.create({
      data: {
        userId: user.id,
        username,
        displayName,
        theme: DEFAULT_APPEARANCE as unknown as Prisma.InputJsonValue,
        socials: {},
        isPublished: true,
      },
    });
  });

  console.log(`Created owner ${email} (${username}) with a published profile.`);
}

seedOwner()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
