import { z } from "zod";
import { fail } from "../../lib/errors";

export const EXPORT_SECTIONS = [
  "profile",
  "links",
  "categories",
  "analytics",
] as const;

export type ExportSection = (typeof EXPORT_SECTIONS)[number];
export type ExportFormat = "json" | "csv" | "profile";

export const exportQuerySchema = z.object({
  format: z.enum(["json", "csv", "profile"]).default("json"),
  // Accept both `?include=profile,links` and repeated `?include=profile&include=links`.
  include: z.union([z.string(), z.array(z.string())]).optional(),
});

export type ExportQuery = z.infer<typeof exportQuerySchema>;

export interface ExportOptions {
  format: ExportFormat;
  sections: Set<ExportSection>;
}

function isExportSection(value: string): value is ExportSection {
  return (EXPORT_SECTIONS as readonly string[]).includes(value);
}

/**
 * `format=profile` is the UI's profile-only variant: public profile, appearance
 * and active links. Include toggles are ignored for that format.
 */
export function parseExportOptions(query: ExportQuery): ExportOptions {
  if (query.format === "profile") {
    return {
      format: "profile",
      sections: new Set<ExportSection>(["profile", "links"]),
    };
  }

  if (query.include === undefined) {
    return {
      format: query.format,
      sections: new Set<ExportSection>(EXPORT_SECTIONS),
    };
  }

  const raw = Array.isArray(query.include)
    ? query.include.join(",")
    : query.include;
  const parts = raw
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);

  if (parts.length === 0) {
    throw fail.validation("Choose at least one section to export.");
  }

  const sections = new Set<ExportSection>();
  for (const part of parts) {
    if (!isExportSection(part)) {
      throw fail.validation(`Unknown export section "${part}".`);
    }
    sections.add(part);
  }

  return { format: query.format, sections };
}
