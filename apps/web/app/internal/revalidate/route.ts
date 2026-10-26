import { timingSafeEqual, createHmac } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";

const PROFILE_TAG = /^profile:[a-z0-9-]{3,30}$/;
const MAX_TAGS = 10;
const MAX_CLOCK_SKEW_SECONDS = 300;

function validSignature(secret: string, timestamp: string, body: string, signature: string) {
  const expected = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(signature, "hex");
  if (expectedBuffer.length !== actualBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, actualBuffer);
}

/**
 * Internal cache-purge endpoint called by the API after profile mutations.
 * Requests are authenticated with a short-lived HMAC over the raw body, so a
 * leaked URL cannot purge arbitrary tags.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Revalidation is not configured." } },
      { status: 503 },
    );
  }

  const timestamp = request.headers.get("x-revalidate-timestamp") ?? "";
  const signature = request.headers.get("x-revalidate-signature") ?? "";
  if (!/^\d{1,12}$/.test(timestamp) || !/^[a-f0-9]{64}$/i.test(signature)) {
    return NextResponse.json(
      { success: false, error: { code: "FORBIDDEN", message: "Invalid signature." } },
      { status: 403 },
    );
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > MAX_CLOCK_SKEW_SECONDS) {
    return NextResponse.json(
      { success: false, error: { code: "FORBIDDEN", message: "Expired signature." } },
      { status: 403 },
    );
  }

  const body = await request.text();
  if (!validSignature(secret, timestamp, body, signature)) {
    return NextResponse.json(
      { success: false, error: { code: "FORBIDDEN", message: "Invalid signature." } },
      { status: 403 },
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid JSON body." } },
      { status: 400 },
    );
  }

  const tags = (payload as { tags?: unknown })?.tags;
  if (!Array.isArray(tags)) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "tags must be an array." } },
      { status: 400 },
    );
  }

  const safeTags = Array.from(
    new Set(tags.filter((tag): tag is string => typeof tag === "string" && PROFILE_TAG.test(tag))),
  ).slice(0, MAX_TAGS);

  for (const tag of safeTags) {
    revalidateTag(tag, { expire: 0 });
  }

  return new NextResponse(null, { status: 204 });
}
