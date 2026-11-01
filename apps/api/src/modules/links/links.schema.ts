import { z } from "zod";
import {
  LIMITS,
  LINK_ICON_IDS,
  normalizeUrl,
  parseYouTubeId,
} from "@linkhub/shared";
import { safeLinkUrlSchema } from "../../lib/validation";

const linkFields = {
  title: z
    .string()
    .trim()
    .min(1, "Give the link a title.")
    .max(LIMITS.maxLinkTitle, `Keep it under ${LIMITS.maxLinkTitle} characters.`),
  url: safeLinkUrlSchema,
  description: z
    .string()
    .trim()
    .max(LIMITS.maxLinkDescription, `Keep it under ${LIMITS.maxLinkDescription} characters.`),
  categoryId: z.uuid().nullable(),
  icon: z.enum(LINK_ICON_IDS),
  isActive: z.boolean(),
};

const configRecord = z.record(z.string(), z.unknown());

const createBase = {
  title: linkFields.title,
  description: linkFields.description.default(""),
  categoryId: linkFields.categoryId.default(null),
  icon: linkFields.icon.default("auto"),
  isActive: linkFields.isActive.default(true),
  config: configRecord.optional(),
};

const createUnion = z.discriminatedUnion("type", [
  z.object({
    ...createBase,
    type: z.literal("link"),
    url: linkFields.url,
  }),
  z.object({
    ...createBase,
    type: z.literal("header"),
    url: z.literal("").default(""),
  }),
  z.object({
    ...createBase,
    type: z.literal("youtube"),
    url: linkFields.url.refine(
      (value) => parseYouTubeId(value) !== null,
      "Paste a YouTube video link.",
    ),
  }),
  z.object({
    ...createBase,
    type: z.literal("contact"),
    url: z.literal("").default(""),
  }),
]);

// Old clients that don't send `type` keep working as plain links.
export const createLinkApiSchema = z.preprocess(
  (value) =>
    value && typeof value === "object" && !("type" in value)
      ? { ...value, type: "link" }
      : value,
  createUnion,
);

// Partial updates must not carry create-time defaults: omitting a field has to
// leave the stored value untouched. `type` is immutable and is not accepted;
// `config` is validated in the service against the stored type.
export const updateLinkApiSchema = z
  .object({
    title: linkFields.title.optional(),
    url: z.union([z.literal(""), linkFields.url]).optional(),
    description: linkFields.description.optional(),
    categoryId: linkFields.categoryId.optional(),
    icon: linkFields.icon.optional(),
    isActive: linkFields.isActive.optional(),
    config: configRecord.optional(),
  })
  .strict();

export const linkStatusApiSchema = z.object({
  isActive: z.boolean(),
});

// Preview requests are read-only and accept only a destination URL. They are
// never part of create/update bodies, so metadata cannot be client-supplied.
export const linkMetadataPreviewApiSchema = z
  .object({
    url: z
      .string()
      .trim()
      .min(1, "Add a URL to preview.")
      .max(2048, "Keep the URL under 2048 characters.")
      .refine(
        (value) => normalizeUrl(value) !== null,
        "Enter a valid http(s) URL.",
      ),
  })
  .strict();

export const reorderLinksApiSchema = z.object({
  ids: z.array(z.uuid()).max(LIMITS.maxLinks),
  categoryId: z.uuid().nullable().optional(),
});

export const listLinksQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  categoryId: z.uuid().optional(),
  status: z.enum(["all", "active", "inactive"]).default("all"),
});

export type CreateLinkInput = z.infer<typeof createLinkApiSchema>;
export type UpdateLinkInput = z.infer<typeof updateLinkApiSchema>;
export type ListLinksQuery = z.infer<typeof listLinksQuerySchema>;
export type LinkMetadataPreviewInput = z.infer<
  typeof linkMetadataPreviewApiSchema
>;
