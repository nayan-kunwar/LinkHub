import { isbot } from "isbot";
import { env } from "../../config/env";
import { matchesWebProxySecret, visitorHash } from "../../lib/crypto";
import { prisma } from "../../lib/db";

export interface ClickContext {
  linkId: string;
  referrer?: string;
  ip?: string;
  userAgent?: string;
  countryHeader?: string;
  proxySecret?: string;
}

const APP_HOST = new URL(env.APP_URL).hostname.toLowerCase();

function parseReferrerHost(referrer: string | undefined): string | null {
  if (!referrer) return null;
  const candidate = referrer.includes("://") ? referrer : `https://${referrer}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    if (!host || host === APP_HOST || host.endsWith(`.${APP_HOST}`)) return null;
    return host.slice(0, 255);
  } catch {
    return null;
  }
}

function deviceType(userAgent: string): string {
  if (/ipad|tablet|playbook|silk/i.test(userAgent)) return "tablet";
  if (/mobi|android|iphone|ipod/i.test(userAgent)) return "mobile";
  return "desktop";
}

function trustedCountry(header: string | undefined, secret: string | undefined): string | null {
  if (!matchesWebProxySecret(secret)) return null;
  if (!header || !/^[A-Z]{2}$/.test(header)) return null;
  return header;
}

/** Best-effort ingest. Every failure is swallowed by the caller and returns 204. */
export async function recordClick(context: ClickContext): Promise<void> {
  const userAgent = context.userAgent;
  if (!userAgent || isbot(userAgent)) return;

  const link = await prisma.link.findFirst({
    where: {
      id: context.linkId,
      isActive: true,
      deletedAt: null,
      user: {
        status: "active",
        deletedAt: null,
        profile: { is: { isPublished: true } },
      },
    },
    select: { id: true, userId: true },
  });
  if (!link) return;

  const now = new Date();
  const hash = visitorHash(context.ip, userAgent, link.id, now);

  if (hash) {
    const recent = await prisma.clickEvent.findFirst({
      where: {
        visitorHash: hash,
        clickedAt: {
          gte: new Date(now.getTime() - env.CLICK_DEDUPE_SECONDS * 1000),
        },
      },
      select: { id: true },
    });
    if (recent) return;
  }

  await prisma.clickEvent.create({
    data: {
      linkId: link.id,
      userId: link.userId,
      clickedAt: now,
      referrerHost: parseReferrerHost(context.referrer),
      deviceType: deviceType(userAgent),
      countryCode: trustedCountry(context.countryHeader, context.proxySecret),
      visitorHash: hash,
    },
  });
}
