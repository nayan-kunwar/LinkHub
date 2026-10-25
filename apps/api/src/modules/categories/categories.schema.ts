import { z } from "zod";
import {
  CATEGORY_ICON_IDS,
  LIMITS,
} from "@linkhub/shared";

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit hex color, for example #7c3aed.");

const categoryFields = {
  name: z
    .string()
    .trim()
    .min(1, "Give the category a name.")
    .max(LIMITS.maxCategoryName, `Keep it under ${LIMITS.maxCategoryName} characters.`),
  description: z
    .string()
    .trim()
    .max(
      LIMITS.maxCategoryDescription,
      `Keep it under ${LIMITS.maxCategoryDescription} characters.`,
    ),
  color: hexColor,
  icon: z.enum(CATEGORY_ICON_IDS),
  isVisible: z.boolean(),
};

export const createCategoryApiSchema = z.object({
  name: categoryFields.name,
  description: categoryFields.description.default(""),
  color: categoryFields.color.default("#7c3aed"),
  icon: categoryFields.icon.default("folder"),
  isVisible: categoryFields.isVisible.default(true),
});

// Partial updates must not carry create-time defaults: omitting a field has to
// leave the stored value untouched.
export const updateCategoryApiSchema = z.object(categoryFields).partial();

export const reorderCategoriesApiSchema = z.object({
  ids: z.array(z.uuid()).max(LIMITS.maxCategories),
});

export type CreateCategoryInput = z.infer<typeof createCategoryApiSchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategoryApiSchema>;
