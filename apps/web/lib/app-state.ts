import type {
  AppearanceSettings,
  Category,
  Link,
  Profile,
  SessionSummary,
} from "@linkhub/shared";

export interface AppAccount {
  id: string;
  email: string;
  emailVerified: boolean;
  pendingEmail: string | null;
  plan: string;
  status: string;
  createdAt: string;
  deletionScheduledFor: string | null;
  connectedProviders: string[];
  hasPassword: boolean;
}

export interface AppState {
  profile: Profile;
  account: AppAccount;
  categories: Category[];
  links: Link[];
  appearance: AppearanceSettings;
  sessions: SessionSummary[];
}

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

export const EMPTY_PROFILE: Profile = {
  id: "",
  username: "",
  displayName: "",
  headline: "",
  bio: "",
  avatarUrl: "",
  socials: {
    website: "",
    github: "",
    linkedin: "",
    x: "",
    medium: "",
    email: "",
  },
  isPublished: false,
};

export const EMPTY_ACCOUNT: AppAccount = {
  id: "",
  email: "",
  emailVerified: false,
  pendingEmail: null,
  plan: "free",
  status: "anonymous",
  createdAt: new Date(0).toISOString(),
  deletionScheduledFor: null,
  connectedProviders: [],
  hasPassword: false,
};

export function createEmptyState(): AppState {
  return {
    profile: { ...EMPTY_PROFILE, socials: { ...EMPTY_PROFILE.socials } },
    account: { ...EMPTY_ACCOUNT },
    categories: [],
    links: [],
    appearance: { ...DEFAULT_APPEARANCE },
    sessions: [],
  };
}
