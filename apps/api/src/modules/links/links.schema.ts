import { z } from "zod";
import { LIMITS, LINK_ICON_IDS } from "@linkhub/shared";
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

export const createLinkApiSchema = z.object({
  title: linkFields.title,
  url: linkFields.url,
  description: linkFields.description.default(""),
  categoryId: linkFields.categoryId.default(null),
  icon: linkFields.icon.default("auto"),
  isActive: linkFields.isActive.default(true),
});

// Partial updates must not carry create-time defaults: omitting a field has to
// leave the stored value untouched.
export const updateLinkApiSchema = z.object(linkFields).partial();

export const linkStatusApiSchema = z.object({
  isActive: z.boolean(),
});

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
