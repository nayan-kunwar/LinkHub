import { z } from "zod";
import { LIMITS } from "@linkhub/shared";

export const changeEmailApiSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  currentPassword: z.string().min(1, "Confirm with your current password."),
});

export const changePasswordApiSchema = z.object({
  // Passwordless Google accounts set their first password without a current
  // one. Accounts that already have a password must still provide it.
  currentPassword: z.string().min(1, "Enter your current password.").optional(),
  newPassword: z
    .string()
    .min(LIMITS.minPassword, `Use at least ${LIMITS.minPassword} characters.`)
    .max(LIMITS.maxPassword, `Use at most ${LIMITS.maxPassword} characters.`),
});

export const deleteAccountApiSchema = z.object({
  password: z.string().min(1, "Enter your password to continue."),
  confirmUsername: z.string().trim().min(1, 'Type your username to confirm.'),
});

export const restoreAccountApiSchema = z.object({
  token: z.string().trim().min(20, "This link is invalid.").max(256, "This link is invalid."),
});
