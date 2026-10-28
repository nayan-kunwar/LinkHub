import { prisma } from "../../lib/db";
import { accountDetailsDto, type AccountDetailsDto } from "../../lib/dto";
import { fail } from "../../lib/errors";

export async function getAccount(userId: string): Promise<AccountDetailsDto> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      accounts: {
        select: { provider: true },
        orderBy: { provider: "asc" },
      },
    },
  });
  if (!user || user.deletedAt) throw fail.unauthenticated();
  return accountDetailsDto(
    user,
    user.accounts.map((account) => account.provider),
  );
}

export async function getConnectedProviders(userId: string): Promise<string[]> {
  const accounts = await prisma.account.findMany({
    where: { userId },
    select: { provider: true },
    orderBy: { provider: "asc" },
  });
  return accounts.map((account) => account.provider);
}

export async function getFullUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt) throw fail.unauthenticated();
  return user;
}
