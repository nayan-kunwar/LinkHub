import type { Prisma } from "@prisma/client";
import {
  linkConfigSchemas,
  parseYouTubeId,
  type LinkType,
} from "@linkhub/shared";
import { fail } from "../../lib/errors";

/**
 * Partial config updates must not wipe fields the client did not send.
 * Defaults for omitted fields are applied later by the type's schema.
 */
export function mergeConfigInput(
  current: unknown,
  input: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const base =
    current && typeof current === "object" && !Array.isArray(current)
      ? (current as Record<string, unknown>)
      : {};
  return { ...base, ...(input ?? {}) };
}

/** Validates and normalises config for a type. Throws a 400 with field paths. */
export function normaliseConfig(
  type: LinkType,
  url: string,
  raw: unknown,
): Prisma.InputJsonValue {
  let input = raw;
  if (type === "youtube") {
    const videoId = parseYouTubeId(url);
    if (!videoId) {
      throw fail.validation("Paste a YouTube video link.", [
        { path: "url", message: "Paste a YouTube video link." },
      ]);
    }
    // Server-derived; never trust the client's videoId.
    input = { videoId };
  }

  const parsed = linkConfigSchemas[type].safeParse(input ?? {});
  if (!parsed.success) {
    throw fail.validation(
      "Some block settings are invalid.",
      parsed.error.issues.map((issue) => ({
        path: ["config", ...issue.path].join("."),
        message: issue.message,
      })),
    );
  }
  return parsed.data as Prisma.InputJsonValue;
}
