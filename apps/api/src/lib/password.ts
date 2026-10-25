import argon2 from "argon2";
import { LIMITS } from "@linkhub/shared";

const ARGON_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19 * 1024,
  timeCost: 2,
  parallelism: 1,
} as const;

let dummyHashPromise: Promise<string> | null = null;

function capPassword(password: string): string {
  return password.slice(0, LIMITS.maxPassword);
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(capPassword(password), ARGON_OPTIONS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, capPassword(password));
  } catch {
    return false;
  }
}

/**
 * Unknown-email logins still perform a full argon2 verify so response timing
 * does not reveal whether an account exists.
 */
export async function dummyVerify(password: string): Promise<void> {
  dummyHashPromise ??= argon2.hash("linkhub-dummy-password-value", ARGON_OPTIONS);
  const hash = await dummyHashPromise;
  await verifyPassword(hash, password);
}
