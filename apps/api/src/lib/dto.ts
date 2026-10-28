import type { Category, Link, Profile, User } from "@prisma/client";
import {
  appearanceSchema,
  socialsSchema,
  type AppearanceSettings,
  type Category as CategoryDto,
  type Link as LinkDto,
  type SocialLinks,
} from "@linkhub/shared";

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  theme: "default",
  color: "#7c3aed",
  background: "gradient",
  card: "rounded",
  button: "solid",
  showAvatar: true,
  showBio: true,
  showSocial: true,
  showDescription: false,
};

export const EMPTY_SOCIALS: SocialLinks = {
  website: "",
  github: "",
  linkedin: "",
  x: "",
  medium: "",
  email: "",
};

export function parseAppearance(value: unknown): AppearanceSettings {
  const parsed = appearanceSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_APPEARANCE;
}

export function parseSocials(value: unknown): SocialLinks {
  const parsed = socialsSchema.partial().safeParse(value);
  return { ...EMPTY_SOCIALS, ...(parsed.success ? parsed.data : {}) };
}

export interface AccountDto {
  email: string;
  pendingEmail: string | null;
  emailVerified: boolean;
  plan: string;
  status: string;
  role: string;
  createdAt: string;
  deletionScheduledFor: string | null;
}

export function accountDto(user: Pick<
  User,
  | "email"
  | "pendingEmail"
  | "emailVerifiedAt"
  | "plan"
  | "status"
  | "role"
  | "createdAt"
  | "deletionScheduledFor"
>): AccountDto {
  return {
    email: user.email,
    pendingEmail: user.pendingEmail,
    emailVerified: Boolean(user.emailVerifiedAt),
    plan: user.plan,
    status: user.status,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    deletionScheduledFor: user.deletionScheduledFor?.toISOString() ?? null,
  };
}

export interface AccountDetailsDto extends AccountDto {
  connectedProviders: string[];
  hasPassword: boolean;
}

export function accountDetailsDto(
  user: User,
  connectedProviders: string[],
): AccountDetailsDto {
  return {
    ...accountDto(user),
    connectedProviders,
    hasPassword: Boolean(user.passwordHash),
  };
}

export interface ProfileDto {
  id: string;
  username: string;
  displayName: string;
  headline: string;
  bio: string;
  avatarUrl: string;
  socials: SocialLinks;
  isPublished: boolean;
  appearance: AppearanceSettings;
}

export function profileDto(profile: Profile): ProfileDto {
  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.displayName,
    headline: profile.headline ?? "",
    bio: profile.bio ?? "",
    avatarUrl: profile.avatarUrl ?? "",
    socials: parseSocials(profile.socials),
    isPublished: profile.isPublished,
    appearance: parseAppearance(profile.theme),
  };
}

export interface MeDto {
  user: AccountDto & { id: string };
  profile: ProfileDto | null;
}

export function meDto(
  user: User,
  profile: Profile | null,
): MeDto {
  return {
    user: { id: user.id, ...accountDto(user) },
    profile: profile ? profileDto(profile) : null,
  };
}

export function linkDto(link: Link): LinkDto {
  return {
    id: link.id,
    title: link.title,
    url: link.url,
    description: link.description ?? "",
    categoryId: link.categoryId,
    icon: link.icon as LinkDto["icon"],
    isActive: link.isActive,
    sortOrder: link.sortOrder,
    createdAt: link.createdAt.toISOString(),
  };
}

export type CategoryWithCount = Category & { _count?: { links: number } };

export function categoryDto(category: CategoryWithCount): CategoryDto & { linkCount: number } {
  return {
    id: category.id,
    name: category.name,
    description: category.description ?? "",
    color: category.color,
    icon: category.icon as CategoryDto["icon"],
    isVisible: category.isVisible,
    sortOrder: category.sortOrder,
    linkCount: category._count?.links ?? 0,
  };
}

export interface PublicProfileDto {
  profile: {
    username: string;
    displayName: string;
    headline: string;
    bio: string;
    avatarUrl: string;
    socials: SocialLinks;
  };
  appearance: AppearanceSettings;
  categories: Array<{
    id: string;
    name: string;
    description: string;
    color: string;
    icon: string;
    sortOrder: number;
  }>;
  links: Array<{
    id: string;
    title: string;
    url: string;
    description: string;
    categoryId: string | null;
    icon: string;
    sortOrder: number;
  }>;
}

export function publicProfileDto(
  profile: Profile,
  categories: Category[],
  links: Link[],
): PublicProfileDto {
  return {
    profile: {
      username: profile.username,
      displayName: profile.displayName,
      headline: profile.headline ?? "",
      bio: profile.bio ?? "",
      avatarUrl: profile.avatarUrl ?? "",
      socials: parseSocials(profile.socials),
    },
    appearance: parseAppearance(profile.theme),
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      description: category.description ?? "",
      color: category.color,
      icon: category.icon,
      sortOrder: category.sortOrder,
    })),
    links: links.map((link) => ({
      id: link.id,
      title: link.title,
      url: link.url,
      description: link.description ?? "",
      categoryId: link.categoryId,
      icon: link.icon,
      sortOrder: link.sortOrder,
    })),
  };
}
