import { cleanupFixtures } from "./fixtures";

export default async function globalTeardown(): Promise<void> {
  await cleanupFixtures();
}
