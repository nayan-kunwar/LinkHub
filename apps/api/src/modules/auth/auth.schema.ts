import { z } from "zod";
import {
  forgotPasswordSchema,
  LIMITS,
  loginSchema,
  signupSchema,
} from "@linkhub/shared";
import { apiUsernameSchema } from "../../lib/validation";

export { forgotPasswordSchema, loginSchema, signupSchema };

/**
 * API registration uses the API username schema (no reserved-name refinement)
 * so reserved names surface as 409 USERNAME_RESERVED from the service layer,
 * matching the rest of the username contract.
 */
export const signupApiSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(1, "Add your full name.")
      .max(LIMITS.maxDisplayName),
    username: apiUsernameSchema,
    email: z.string().trim().email("Enter a valid email address."),
    password: z
      .string()
      .min(LIMITS.minPassword, `Use at least ${LIMITS.minPassword} characters.`)
      .max(LIMITS.maxPassword, `Use at most ${LIMITS.maxPassword} characters.`),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export const tokenSchema = z.object({
  token: z.string().trim().min(20, "This link is invalid.").max(256, "This link is invalid."),
});

const googleCredentialSchema = z
  .string()
  .trim()
  .min(20, "Google sign-in failed. Try again.")
  .max(8192, "Google sign-in failed. Try again.");

export const googleAuthSchema = z.object({
  credential: googleCredentialSchema,
  remember: z.boolean().optional(),
});

export const googleLinkSchema = z.object({
  credential: googleCredentialSchema,
});

export const googleSignupSchema = z.object({
  credential: googleCredentialSchema,
  username: apiUsernameSchema,
  remember: z.boolean().optional(),
});

export const resetPasswordApiSchema = z.object({
  token: z.string().trim().min(20, "This link is invalid.").max(256, "This link is invalid."),
  password: z
    .string()
    .min(LIMITS.minPassword, `Use at least ${LIMITS.minPassword} characters.`)
    .max(LIMITS.maxPassword, `Use at most ${LIMITS.maxPassword} characters.`),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupApiSchema>;
export type TokenInput = z.infer<typeof tokenSchema>;
export type ResetPasswordApiInput = z.infer<typeof resetPasswordApiSchema>;
export type GoogleAuthInput = z.infer<typeof googleAuthSchema>;
export type GoogleLinkInput = z.infer<typeof googleLinkSchema>;
export type GoogleSignupInput = z.infer<typeof googleSignupSchema>;
