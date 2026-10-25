import { prisma } from "../../lib/db";
import { accountDto, type AccountDto } from "../../lib/dto";
import { fail } from "../../lib/errors";

export async function getAccount(userId: string): Promise<AccountDto> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt) throw fail.unauthenticated();
  return accountDto(user);
}

export async function getFullUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt) throw fail.unauthenticated();
  return user;
}
