import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTVerifyGetKey,
  type JWTPayload,
} from "jose";
import { env } from "../config/env";
import { fail } from "./errors";

const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS = ["accounts.google.com", "https://accounts.google.com"];

/**
 * Google ID tokens are short-lived bearer credentials. We accept only RS256
 * signatures from Google's published keys, an exact audience match, one of
 * Google's two issuer spellings, and a token no older than 15 minutes.
 */
const googleJwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));

export interface GoogleIdentity {
  /** Stable Google subject. This is the only Google value we persist. */
  sub: string;
  email: string;
  /**
   * Google profile name, when present. Used only to prefill a new profile's
   * display name; it is never matched against an existing account.
   */
  name?: string;
}

export interface VerifyGoogleIdTokenOptions {
  clientId: string;
  jwks: JWTVerifyGetKey;
  /** Injectable clock for tests; production uses the current time. */
  currentDate?: Date;
}

/**
 * Pure verifier used by the service wrapper and unit tests. It deliberately
 * returns only the Google subject, email, and optional profile name; callers
 * must not use the email to match an existing account or persist the name.
 */
export async function verifyGoogleIdToken(
  credential: string,
  options: VerifyGoogleIdTokenOptions,
): Promise<GoogleIdentity> {
  let payload: JWTPayload;
  try {
    const result = await jwtVerify(credential, options.jwks, {
      algorithms: ["RS256"],
      issuer: GOOGLE_ISSUERS,
      audience: options.clientId,
      maxTokenAge: "15m",
      clockTolerance: 30,
      requiredClaims: ["sub", "iat", "exp", "email", "email_verified"],
      ...(options.currentDate ? { currentDate: options.currentDate } : {}),
    });
    payload = result.payload;
  } catch {
    throw fail.googleTokenInvalid();
  }

  // Google only includes azp when the token has multiple audiences. If it is
  // present, it must identify this client rather than another authorized app.
  if (payload.azp !== undefined && payload.azp !== options.clientId) {
    throw fail.googleTokenInvalid();
  }

  if (
    typeof payload.sub !== "string" ||
    payload.sub.length === 0 ||
    payload.sub.length > 255
  ) {
    throw fail.googleTokenInvalid();
  }

  if (
    typeof payload.email !== "string" ||
    payload.email.length === 0 ||
    payload.email.length > 320
  ) {
    throw fail.googleTokenInvalid();
  }

  if (payload.email_verified !== true && payload.email_verified !== "true") {
    throw fail.googleEmailUnverified();
  }

  const name =
    typeof payload.name === "string" ? payload.name.trim().slice(0, 255) : "";

  return {
    sub: payload.sub,
    email: payload.email,
    ...(name ? { name } : {}),
  };
}

export async function verifyGoogleCredential(
  credential: string,
): Promise<GoogleIdentity> {
  if (!env.GOOGLE_CLIENT_ID) throw fail.googleSignInDisabled();

  return verifyGoogleIdToken(credential, {
    clientId: env.GOOGLE_CLIENT_ID,
    jwks: googleJwks,
  });
}
