import type {
  CATEGORY_ICON_IDS,
  LINK_ICON_IDS,
  SOCIAL_KEYS,
  THEME_IDS,
} from "./constants";

export type ThemeId = (typeof THEME_IDS)[number];
export type LinkIconId = (typeof LINK_ICON_IDS)[number];
export type CategoryIconId = (typeof CATEGORY_ICON_IDS)[number];
export type SocialKey = (typeof SOCIAL_KEYS)[number];

export interface SocialLinks {
  website: string;
  github: string;
  linkedin: string;
  x: string;
  medium: string;
  email: string;
}

export interface Profile {
  id: string;
  username: string;
  displayName: string;
  headline: string;
  bio: string;
  avatarUrl: string;
  socials: SocialLinks;
  isPublished: boolean;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: CategoryIconId;
  isVisible: boolean;
  sortOrder: number;
}

export interface Link {
  id: string;
  title: string;
  url: string;
  description: string;
  categoryId: string | null;
  icon: LinkIconId;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface AppearanceSettings {
  theme: ThemeId;
  color: string;
  background: "solid" | "gradient" | "pattern" | "blur";
  card: "rounded" | "soft" | "minimal";
  button: "solid" | "outline" | "glass";
  showAvatar: boolean;
  showBio: boolean;
  showSocial: boolean;
  showDescription: boolean;
}

export interface SessionSummary {
  id: string;
  userAgent: string;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
}

export interface PublicProfile {
  profile: Pick<Profile, "username" | "displayName" | "headline" | "bio" | "avatarUrl" | "socials">;
  appearance: AppearanceSettings;
  categories: Array<Pick<Category, "id" | "name" | "icon" | "color" | "sortOrder">>;
  links: Array<Pick<Link, "id" | "title" | "url" | "description" | "categoryId" | "icon" | "sortOrder">>;
}

export interface DailyPoint {
  date: string;
  count: number;
}

export interface BreakdownSlice {
  key: string;
  label: string;
  count: number;
  share: number;
  color?: string;
}

export interface AnalyticsOverview {
  rangeDays: number;
  total: number;
  previousTotal: number;
  change: number | null;
  averagePerDay: number;
  activeLinks: number;
  totalLinks: number;
  peakDay: DailyPoint | null;
  series: DailyPoint[];
  topLinks: Array<{ linkId: string; title: string; count: number; share: number }>;
  referrers: BreakdownSlice[];
  devices: BreakdownSlice[];
  countries: BreakdownSlice[];
  insights: string[];
}
