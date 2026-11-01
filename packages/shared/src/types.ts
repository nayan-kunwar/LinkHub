import type {
  ButtonStyle,
  CardStyle,
  CATEGORY_ICON_IDS,
  FontChoice,
  LINK_ICON_IDS,
  LinkType,
  ProfileLayout,
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

export interface LinkMetadata {
  sourceUrl: string;
  finalUrl: string;
  title: string;
  description: string;
  imageUrl: string;
  siteName: string;
  fetchedAt: string | null;
}

export interface Link {
  id: string;
  title: string;
  url: string;
  type: LinkType;
  config: Record<string, unknown>;
  metadata: LinkMetadata;
  previewImageUrl: string;
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
  card: CardStyle;
  button: ButtonStyle;
  layout: ProfileLayout;
  font: FontChoice;
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
  links: Array<
    Pick<
      Link,
      | "id"
      | "title"
      | "url"
      | "type"
      | "config"
      | "description"
      | "categoryId"
      | "icon"
      | "sortOrder"
      | "previewImageUrl"
    >
  >;
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
