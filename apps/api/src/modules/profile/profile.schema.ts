import { z } from "zod";
import { appearanceSchema, LIMITS } from "@linkhub/shared";
import {
  apiUsernameSchema,
  optionalSafeHttpsUrlSchema,
  safeSocialsSchema,
} from "../../lib/validation";

export const updateProfileApiSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Add a display name.")
    .max(LIMITS.maxDisplayName, `Keep it under ${LIMITS.maxDisplayName} characters.`)
    .optional(),
  headline: z
    .string()
    .trim()
    .max(LIMITS.maxHeadline, `Keep it under ${LIMITS.maxHeadline} characters.`)
    .optional(),
  bio: z
    .string()
    .trim()
    .max(LIMITS.maxBio, `Keep the bio under ${LIMITS.maxBio} characters.`)
    .optional(),
  avatarUrl: optionalSafeHttpsUrlSchema.optional(),
  socials: safeSocialsSchema.optional(),
  username: apiUsernameSchema.optional(),
  appearance: appearanceSchema.optional(),
});
