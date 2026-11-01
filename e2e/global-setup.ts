import { readFixtures, revalidateProfileCache, seedFixtures } from "./fixtures";

export default async function globalSetup(): Promise<void> {
  await seedFixtures();
  await revalidateProfileCache(readFixtures().username);
}
