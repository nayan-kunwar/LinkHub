import { beforeAll, describe, expect, it } from "vitest";
import {
  SignJWT,
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  type JWTVerifyGetKey,
} from "jose";
import { verifyGoogleIdToken } from "./google";

const CLIENT_ID = "test-google-client-id.apps.googleusercontent.com";

let privateKey: Awaited<ReturnType<typeof generateKeyPair>>["privateKey"];
let jwks: JWTVerifyGetKey;

beforeAll(async () => {
  const keys = await generateKeyPair("RS256");
  privateKey = keys.privateKey;
  jwks = createLocalJWKSet({
    keys: [{ ...(await exportJWK(keys.publicKey)), kid: "test-key", alg: "RS256" }],
  });
});

interface TokenOptions {
  issuer?: string;
  audience?: string;
  issuedAt?: number;
  expiresAt?: number;
  includeSubject?: boolean;
  claims?: Record<string, unknown>;
}

async function signToken(options: TokenOptions = {}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const token = new SignJWT({
    email: "owner@example.com",
    email_verified: true,
    ...options.claims,
  })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(options.issuer ?? "https://accounts.google.com")
    .setAudience(options.audience ?? CLIENT_ID)
    .setIssuedAt(options.issuedAt ?? now)
    .setExpirationTime(options.expiresAt ?? now + 10 * 60);

  if (options.includeSubject !== false) token.setSubject("google-sub-1");
  return token.sign(privateKey);
}

async function verify(token: string) {
  return verifyGoogleIdToken(token, { clientId: CLIENT_ID, jwks });
}

describe("Google ID token verification", () => {
  it("accepts a valid Google token and returns only the subject and email", async () => {
    await expect(verify(await signToken())).resolves.toEqual({
      sub: "google-sub-1",
      email: "owner@example.com",
    });
  });

  it("accepts both Google issuer spellings", async () => {
    await expect(
      verify(await signToken({ issuer: "accounts.google.com" })),
    ).resolves.toMatchObject({ sub: "google-sub-1" });
  });

  it("rejects a token for another client", async () => {
    await expect(
      verify(await signToken({ audience: "another-client.apps.googleusercontent.com" })),
    ).rejects.toMatchObject({ code: "GOOGLE_TOKEN_INVALID" });
  });

  it("rejects a token from another issuer", async () => {
    await expect(
      verify(await signToken({ issuer: "https://evil.example" })),
    ).rejects.toMatchObject({ code: "GOOGLE_TOKEN_INVALID" });
  });

  it("rejects an expired token", async () => {
    const now = Math.floor(Date.now() / 1000);
    await expect(
      verify(await signToken({ issuedAt: now - 20 * 60, expiresAt: now - 60 })),
    ).rejects.toMatchObject({ code: "GOOGLE_TOKEN_INVALID" });
  });

  it("rejects a token older than the 15-minute age limit", async () => {
    const now = Math.floor(Date.now() / 1000);
    await expect(
      verify(await signToken({ issuedAt: now - 16 * 60, expiresAt: now + 5 * 60 })),
    ).rejects.toMatchObject({ code: "GOOGLE_TOKEN_INVALID" });
  });

  it("rejects an unverified Google email", async () => {
    await expect(
      verify(await signToken({ claims: { email_verified: false } })),
    ).rejects.toMatchObject({ code: "GOOGLE_EMAIL_UNVERIFIED" });
  });

  it("requires an email_verified claim", async () => {
    await expect(
      verify(await signToken({ claims: { email_verified: undefined } })),
    ).rejects.toMatchObject({ code: "GOOGLE_TOKEN_INVALID" });
  });

  it("rejects a token whose authorized party is another client", async () => {
    await expect(
      verify(await signToken({ claims: { azp: "another-client.apps.googleusercontent.com" } })),
    ).rejects.toMatchObject({ code: "GOOGLE_TOKEN_INVALID" });
  });

  it("rejects a token without a subject", async () => {
    await expect(
      verify(await signToken({ includeSubject: false })),
    ).rejects.toMatchObject({ code: "GOOGLE_TOKEN_INVALID" });
  });
});
