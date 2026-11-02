import type { Link as PrismaLink } from "@prisma/client";
import {
  normalizeUrl,
  parseLinkConfig,
  parseLinkMetadata,
  parseYouTubeId,
} from "@linkhub/shared";
import { previewImageUrlError } from "./url-safety";

export function youtubeThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

/**
 * The only server-side image selection. Manual images win; otherwise the
 * stored preview is used only when it was fetched for the current URL.
 */
export function previewImageFor(
  link: Pick<PrismaLink, "url" | "type" | "config" | "metadata">,
): string {
  const config = parseLinkConfig(link.type, link.config);
  const manualImage =
    typeof config.imageUrl === "string" ? config.imageUrl.trim() : "";
  if (manualImage) return manualImage;
  if (config.usePreviewImage === false) return "";

  const metadata = parseLinkMetadata(link.metadata);
  if (metadata.imageUrl && metadata.sourceUrl === normalizeUrl(link.url)) {
    try {
      const image = new URL(metadata.imageUrl);
      if (!previewImageUrlError(image)) return metadata.imageUrl;
    } catch {
      // Fall through to the YouTube fallback or icon.
    }
  }

  const videoId = parseYouTubeId(link.url);
  return videoId ? youtubeThumbnail(videoId) : "";
}
