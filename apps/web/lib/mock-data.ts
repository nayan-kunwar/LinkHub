import type {
  AppearanceSettings,
  Category,
  Link,
  Profile,
  SessionSummary,
} from "@linkhub/shared";

export interface MockAccount {
  email: string;
  emailVerified: boolean;
  pendingEmail: string | null;
  plan: "free";
  createdAt: string;
  deletionScheduledFor: string | null;
}

export interface MockLink extends Link {
  /** Seed value used to generate a deterministic click history for the preview. */
  baseWeight: number;
}

export interface MockState {
  version: 2;
  profile: Profile;
  account: MockAccount;
  categories: Category[];
  links: MockLink[];
  appearance: AppearanceSettings;
  sessions: SessionSummary[];
}

export const MOCK_PROFILE: Profile = {
  id: "b0000000-0000-4000-8000-000000000001",
  username: "nayankunwar",
  displayName: "Nayan Kunwar",
  headline: "Backend Engineer",
  bio: "Backend engineer building APIs, distributed systems and developer tools.",
  avatarUrl: "",
  socials: {
    website: "https://nayankunwar.com",
    github: "https://github.com/nayan-kunwar",
    linkedin: "https://www.linkedin.com/in/nayan-kunwar-a1732a202/",
    x: "https://x.com/nayankunwar26",
    medium: "https://medium.com/@nayankunwar678",
    email: "mailto:nayan@example.com",
  },
  isPublished: true,
};

export const MOCK_ACCOUNT: MockAccount = {
  email: "nayan@example.com",
  emailVerified: true,
  pendingEmail: null,
  plan: "free",
  createdAt: "2026-02-18T09:12:00.000Z",
  deletionScheduledFor: null,
};

export const MOCK_CATEGORIES: Category[] = [
  {
    id: "c1000000-0000-4000-8000-000000000001",
    name: "Social",
    description: "Social profiles and communities",
    color: "#db2777",
    icon: "share",
    isVisible: true,
    sortOrder: 0,
  },
  {
    id: "c1000000-0000-4000-8000-000000000002",
    name: "Projects",
    description: "Things I have built",
    color: "#7c3aed",
    icon: "code",
    isVisible: true,
    sortOrder: 1,
  },
  {
    id: "c1000000-0000-4000-8000-000000000003",
    name: "Work",
    description: "Professional profile and portfolio",
    color: "#d97706",
    icon: "briefcase",
    isVisible: true,
    sortOrder: 2,
  },
  {
    id: "c1000000-0000-4000-8000-000000000004",
    name: "Writing",
    description: "Articles and engineering notes",
    color: "#059669",
    icon: "book",
    isVisible: true,
    sortOrder: 3,
  },
  {
    id: "c1000000-0000-4000-8000-000000000005",
    name: "Contact",
    description: "Ways to get in touch",
    color: "#2563eb",
    icon: "mail",
    isVisible: true,
    sortOrder: 4,
  },
  {
    id: "c1000000-0000-4000-8000-000000000006",
    name: "Archive",
    description: "Old links kept for reference",
    color: "#64748b",
    icon: "archive",
    isVisible: false,
    sortOrder: 5,
  },
];

export const MOCK_LINKS: MockLink[] = [
  {
    id: "a1000000-0000-4000-8000-000000000001",
    title: "GitHub",
    url: "https://github.com/nayan-kunwar",
    description: "Open-source code and experiments",
    categoryId: MOCK_CATEGORIES[0].id,
    icon: "github",
    isActive: true,
    sortOrder: 0,
    createdAt: "2026-03-02T08:00:00.000Z",
    baseWeight: 421,
  },
  {
    id: "a1000000-0000-4000-8000-000000000002",
    title: "Portfolio",
    url: "https://nayankunwar.com",
    description: "Projects, résumé and case studies",
    categoryId: MOCK_CATEGORIES[2].id,
    icon: "globe",
    isActive: true,
    sortOrder: 1,
    createdAt: "2026-03-02T08:05:00.000Z",
    baseWeight: 312,
  },
  {
    id: "a1000000-0000-4000-8000-000000000003",
    title: "LinkedIn",
    url: "https://www.linkedin.com/in/nayan-kunwar-a1732a202/",
    description: "Experience and recommendations",
    categoryId: MOCK_CATEGORIES[2].id,
    icon: "linkedin",
    isActive: true,
    sortOrder: 2,
    createdAt: "2026-03-03T10:30:00.000Z",
    baseWeight: 180,
  },
  {
    id: "a1000000-0000-4000-8000-000000000004",
    title: "X",
    url: "https://x.com/nayankunwar26",
    description: "Short thoughts on backend engineering",
    categoryId: MOCK_CATEGORIES[0].id,
    icon: "x",
    isActive: true,
    sortOrder: 3,
    createdAt: "2026-03-05T14:15:00.000Z",
    baseWeight: 161,
  },
  {
    id: "a1000000-0000-4000-8000-000000000005",
    title: "Medium",
    url: "https://medium.com/@nayankunwar678",
    description: "Long-form articles",
    categoryId: null,
    icon: "medium",
    isActive: true,
    sortOrder: 4,
    createdAt: "2026-04-11T11:00:00.000Z",
    baseWeight: 98,
  },
  {
    id: "a1000000-0000-4000-8000-000000000006",
    title: "Link Hub",
    url: "https://link.nayankunwar.com",
    description: "This link-in-bio app, built from scratch",
    categoryId: MOCK_CATEGORIES[1].id,
    icon: "link",
    isActive: true,
    sortOrder: 5,
    createdAt: "2026-08-20T16:45:00.000Z",
    baseWeight: 74,
  },
  {
    id: "a1000000-0000-4000-8000-000000000007",
    title: "Email Me",
    url: "mailto:nayan@example.com",
    description: "Say hello",
    categoryId: MOCK_CATEGORIES[4].id,
    icon: "mail",
    isActive: true,
    sortOrder: 6,
    createdAt: "2026-03-02T08:10:00.000Z",
    baseWeight: 68,
  },
  {
    id: "a1000000-0000-4000-8000-000000000008",
    title: "Old Portfolio (v1)",
    url: "https://v1.nayankunwar.com",
    description: "The first version of my site",
    categoryId: MOCK_CATEGORIES[5].id,
    icon: "file",
    isActive: false,
    sortOrder: 7,
    createdAt: "2025-11-01T09:00:00.000Z",
    baseWeight: 12,
  },
];

export const MOCK_APPEARANCE: AppearanceSettings = {
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

export const MOCK_SESSIONS: SessionSummary[] = [
  {
    id: "s1000000-0000-4000-8000-000000000001",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
    createdAt: "2026-10-22T18:40:00.000Z",
    lastSeenAt: "2026-10-25T12:10:00.000Z",
    current: true,
  },
  {
    id: "s1000000-0000-4000-8000-000000000002",
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1",
    createdAt: "2026-10-19T08:15:00.000Z",
    lastSeenAt: "2026-10-23T09:32:00.000Z",
    current: false,
  },
  {
    id: "s1000000-0000-4000-8000-000000000003",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/537.36 (KHTML, like Gecko) Firefox/141.0 Safari/537.36",
    createdAt: "2026-10-12T20:05:00.000Z",
    lastSeenAt: "2026-10-18T21:44:00.000Z",
    current: false,
  },
];

export const MOCK_STATE: MockState = {
  version: 2,
  profile: MOCK_PROFILE,
  account: MOCK_ACCOUNT,
  categories: MOCK_CATEGORIES,
  links: MOCK_LINKS,
  appearance: MOCK_APPEARANCE,
  sessions: MOCK_SESSIONS,
};

export function createEmptyState(): MockState {
  return structuredClone(MOCK_STATE);
}

export function createId(prefix: "a" | "c" | "s" = "a"): string {
  const random = Math.random().toString(16).slice(2, 10);
  const timestamp = Date.now().toString(16);
  const head = prefix === "a" ? "a1000000" : prefix === "c" ? "c1000000" : "s1000000";
  return `${head}-${timestamp.slice(-4)}-4${random.slice(0, 3)}-8${random.slice(3, 6)}-${timestamp}${random.slice(6, 10)}`.slice(
    0,
    36,
  );
}
