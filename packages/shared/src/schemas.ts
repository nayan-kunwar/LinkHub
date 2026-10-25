import { z } from "zod";
import {
  BACKGROUND_STYLES,
  BUTTON_STYLES,
  CARD_STYLES,
  CATEGORY_ICON_IDS,
  LIMITS,
  LINK_ICON_IDS,
  RESERVED_USERNAMES,
  SOCIAL_KEYS,
  THEME_IDS,
  USERNAME_REGEX,
} from "./constants";

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit hex color, for example #7c3aed.");

const optionalHttpsUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => value === "" || /^https:\/\/[^\s]+$/i.test(value), {
    message: "Enter a full https:// URL.",
  });

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Usernames need at least 3 characters.")
  .max(30, "Usernames can be at most 30 characters.")
  .regex(USERNAME_REGEX, "Use lowercase letters, numbers and hyphens; start and end with a letter or number.")
  .refine((value) => !(RESERVED_USERNAMES as readonly string[]).includes(value), {
    message: "That username is reserved.",
  });

export const socialsSchema = z.object({
  website: optionalHttpsUrl,
  github: optionalHttpsUrl,
  linkedin: optionalHttpsUrl,
  x: optionalHttpsUrl,
  medium: optionalHttpsUrl,
  email: z
    .string()
    .trim()
    .max(254)
    .refine((value) => value === "" || /^mailto:[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value), {
      message: "Use a mailto: link, for example mailto:you@example.com.",
    }),
});

export const appearanceSchema = z.object({
  theme: z.enum(THEME_IDS),
  color: hexColor,
  background: z.enum(BACKGROUND_STYLES),
  card: z.enum(CARD_STYLES),
  button: z.enum(BUTTON_STYLES),
  showAvatar: z.boolean(),
  showBio: z.boolean(),
  showSocial: z.boolean(),
  showDescription: z.boolean(),
});

export const profileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Add a display name.")
    .max(LIMITS.maxDisplayName, `Keep it under ${LIMITS.maxDisplayName} characters.`),
  headline: z.string().trim().max(LIMITS.maxHeadline, `Keep it under ${LIMITS.maxHeadline} characters.`),
  username: usernameSchema,
  bio: z.string().trim().max(LIMITS.maxBio, `Keep the bio under ${LIMITS.maxBio} characters.`),
  avatarUrl: optionalHttpsUrl,
  socials: socialsSchema,
  isPublished: z.boolean(),
});

const linkUrlSchema = z
  .string()
  .trim()
  .min(1, "Add a destination URL.")
  .max(2048)
  .refine((value) => {
    if (/^mailto:/i.test(value)) return /^mailto:[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
    try {
      const url = new URL(value);
      return (url.protocol === "http:" || url.protocol === "https:") && url.hostname.includes(".");
    } catch {
      return false;
    }
  }, "Use an http://, https:// or mailto: link.");

export const linkFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Give the link a title.")
    .max(LIMITS.maxLinkTitle, `Keep it under ${LIMITS.maxLinkTitle} characters.`),
  url: linkUrlSchema,
  categoryId: z.string().nullable(),
  description: z
    .string()
    .trim()
    .max(LIMITS.maxLinkDescription, `Keep it under ${LIMITS.maxLinkDescription} characters.`),
  icon: z.enum(LINK_ICON_IDS),
  isActive: z.boolean(),
});

export const categoryFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the category a name.")
    .max(LIMITS.maxCategoryName, `Keep it under ${LIMITS.maxCategoryName} characters.`),
  description: z
    .string()
    .trim()
    .max(LIMITS.maxCategoryDescription, `Keep it under ${LIMITS.maxCategoryDescription} characters.`),
  color: hexColor,
  icon: z.enum(CATEGORY_ICON_IDS),
  isVisible: z.boolean(),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
  remember: z.boolean().optional(),
});

export const signupSchema = z
  .object({
    displayName: z.string().trim().min(1, "Add your full name.").max(LIMITS.maxDisplayName),
    username: usernameSchema,
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

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
});

export const resetPasswordSchema = z
  .object({
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

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: z
      .string()
      .min(LIMITS.minPassword, `Use at least ${LIMITS.minPassword} characters.`)
      .max(LIMITS.maxPassword, `Use at most ${LIMITS.maxPassword} characters.`),
    confirmPassword: z.string(),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export const changeEmailSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  currentPassword: z.string().min(1, "Confirm with your current password."),
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, "Enter your password to continue."),
  confirm: z.literal("delete my account", {
    message: 'Type "delete my account" to confirm.',
  }),
});

export const socialKeys = SOCIAL_KEYS;

export type Appearance = z.infer<typeof appearanceSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type Socials = z.infer<typeof socialsSchema>;
export type LinkFormValues = z.infer<typeof linkFormSchema>;
export type CategoryFormValues = z.infer<typeof categoryFormSchema>;
export type LoginValues = z.infer<typeof loginSchema>;
export type SignupValues = z.infer<typeof signupSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
export type ChangeEmailValues = z.infer<typeof changeEmailSchema>;
export type DeleteAccountValues = z.infer<typeof deleteAccountSchema>;
