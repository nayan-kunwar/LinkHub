import type { Link as PrismaLink, Prisma } from "@prisma/client";
import {
  normalizeUrl,
  parseLinkConfig,
  parseLinkMetadata,
  type LinkMetadata,
} from "@linkhub/shared";
import { prisma } from "../../lib/db";
import { linkDto } from "../../lib/dto";
import { fail } from "../../lib/errors";
import { logger } from "../../lib/logger";
import {
  fetchMetadataForUser,
  isMetadataFetchEnabled,
  isSkippedMetadataHost,
  metadataFetchFailure,
} from "../../lib/metadata-fetch";
import { scoped } from "../../lib/tenant";
import { revalidateLinkOwner } from "./links.revalidate";

/**
 * Save-time previews are only useful for cards that will actually render an
 * image. Manual images and the per-link opt-out always win.
 */
export function isPreviewEligible(
  link: Pick<PrismaLink, "type" | "url" | "config">,
): boolean {
  if (link.type !== "link") return false;
  const config = parseLinkConfig("link", link.config);
  if (config.layout !== "rich" && config.layout !== "featured") return false;
  const manualImage =
    typeof config.imageUrl === "string" ? config.imageUrl.trim() : "";
  if (manualImage) return false;
  if (config.usePreviewImage === false) return false;
  return normalizeUrl(link.url) !== null;
}

/** Preview-only endpoint. Never persists anything. */
export async function previewLinkMetadata(
  userId: string,
  url: string,
): Promise<LinkMetadata> {
  try {
    return await fetchMetadataForUser(userId, url);
  } catch (error) {
    metadataFetchFailure(error);
  }
}

/**
 * Fetches metadata after a create/update when the link has no usable preview
 * yet. Failures are logged and never fail the save.
 */
export async function maybeFetchLinkMetadata(
  userId: string,
  link: PrismaLink,
): Promise<PrismaLink> {
  if (!isMetadataFetchEnabled()) return link;
  if (!isPreviewEligible(link)) return link;
  if (isSkippedMetadataHost(link.url)) return link;

  const normalized = normalizeUrl(link.url);
  if (!normalized) return link;

  const current = parseLinkMetadata(link.metadata);
  if (current.sourceUrl === normalized && current.fetchedAt) return link;

  try {
    const metadata = await fetchMetadataForUser(userId, normalized);
    if (metadata.sourceUrl !== normalized) return link;
    return await prisma.link.update({
      where: { id: link.id },
      data: { metadata: metadata as unknown as Prisma.InputJsonValue },
    });
  } catch (error) {
    logger.warn(
      { err: error, linkId: link.id },
      "link metadata fetch failed during save",
    );
    return link;
  }
}

/**
 * Manual refresh always bypasses the cache. A failure leaves the previous
 * metadata untouched so a working thumbnail is never wiped.
 */
export async function refreshLinkMetadata(userId: string, id: string) {
  const link = await scoped(userId).links.get(id);
  if (!link) throw fail.notFound();
  if (link.type !== "link") {
    throw fail.validation("Only link blocks can have preview images.");
  }

  const normalized = normalizeUrl(link.url);
  if (!normalized) {
    throw fail.validation("This link does not have a valid http(s) URL.");
  }
  // Instagram/Amazon deliberately have no server-side preview; refreshing
  // must not replace anything that is already stored.
  if (isSkippedMetadataHost(normalized)) return linkDto(link);

  try {
    const metadata = await fetchMetadataForUser(userId, normalized, {
      force: true,
    });
    const result = await scoped(userId).links.update(id, {
      metadata: metadata as unknown as Prisma.InputJsonValue,
    });
    if (result.count === 0) throw fail.notFound();

    const updated = await scoped(userId).links.get(id);
    if (!updated) throw fail.notFound();
    await revalidateLinkOwner(userId);
    return linkDto(updated);
  } catch (error) {
    metadataFetchFailure(error);
  }
}
