import type {
  AnalyticsOverview,
  AppearanceSettings,
  BreakdownSlice,
  Category,
  CategoryFormValues,
  ContactValues,
  DailyPoint,
  Link,
  LinkFormValues,
  Profile,
  SessionSummary,
} from "@linkhub/shared";

const API_PREFIX = "/api/v1";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface ApiAccount {
  id: string;
  email: string;
  pendingEmail: string | null;
  emailVerified: boolean;
  plan: string;
  status: string;
  role: string;
  createdAt: string;
  deletionScheduledFor: string | null;
  /** Present on GET /account; /auth/me returns the base account fields only. */
  connectedProviders?: string[];
  hasPassword?: boolean;
}

export interface ApiProfile extends Profile {
  appearance: AppearanceSettings;
}

export interface MeResponse {
  user: ApiAccount;
  profile: ApiProfile | null;
}

export type LoginResponse = MeResponse & { csrfToken: string };

export interface GoogleSignupRequired {
  signupRequired: true;
  email: string;
  displayName: string;
  suggestedUsername: string;
}

export type GoogleLoginResponse = LoginResponse | GoogleSignupRequired;

export interface AvailabilityResponse {
  available: boolean;
  reason?: "reserved" | "taken" | "invalid";
}

export interface TimeseriesResponse {
  rangeDays: number;
  series: DailyPoint[];
}

export interface BreakdownResponse {
  dimension: "country" | "device" | "referrer";
  rangeDays: number;
  total: number;
  slices: BreakdownSlice[];
}

export type ExportFormat = "json" | "csv" | "profile";
export type ExportSection = "profile" | "links" | "categories" | "analytics";

export interface ExportDownload {
  blob: Blob;
  filename: string;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
  csrf?: boolean;
}

interface Envelope<T> {
  success: true;
  data: T;
}

interface ErrorEnvelope {
  success: false;
  error: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

let csrfToken: string | null = null;
let csrfRequest: Promise<string> | null = null;

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

async function parseError(response: Response): Promise<ApiError> {
  let payload: ErrorEnvelope | null = null;
  try {
    payload = (await response.json()) as ErrorEnvelope;
  } catch {
    // Non-JSON failures (a proxy error page, for example) fall back to status text.
  }

  return new ApiError(
    response.status,
    payload?.error?.code ?? "INTERNAL_ERROR",
    payload?.error?.message ??
      (response.status === 429
        ? "Too many requests. Try again later."
        : "Something went wrong. Try again."),
    payload?.error?.details,
  );
}

async function fetchCsrfToken(): Promise<string> {
  const response = await fetch(`${API_PREFIX}/auth/csrf`, {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) throw await parseError(response);
  const payload = (await response.json()) as Envelope<{ csrfToken: string }>;
  const token = payload.data?.csrfToken;
  if (!token) {
    throw new ApiError(500, "INTERNAL_ERROR", "Could not start a secure session.");
  }
  csrfToken = token;
  return token;
}

export function ensureCsrf(force = false): Promise<string> {
  if (!force && csrfToken) return Promise.resolve(csrfToken);
  if (!force && csrfRequest) return csrfRequest;

  csrfRequest = fetchCsrfToken().finally(() => {
    csrfRequest = null;
  });
  return csrfRequest;
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
  retried = false,
): Promise<T> {
  const method = options.method ?? "GET";
  const headers = new Headers({ Accept: "application/json" });
  const hasBody = options.body !== undefined;

  if (hasBody) headers.set("Content-Type", "application/json");

  if (method !== "GET" && method !== "HEAD" && options.csrf !== false) {
    headers.set("X-CSRF-Token", await ensureCsrf());
  }

  const response = await fetch(`${API_PREFIX}${path}`, {
    method,
    headers,
    body: hasBody ? JSON.stringify(options.body) : undefined,
    credentials: "same-origin",
    cache: "no-store",
    signal: options.signal,
  });

  if (!response.ok) {
    const error = await parseError(response);
    if (
      !retried &&
      response.status === 403 &&
      error.code === "CSRF_INVALID" &&
      method !== "GET" &&
      method !== "HEAD" &&
      options.csrf !== false
    ) {
      await ensureCsrf(true);
      return request<T>(path, options, true);
    }
    throw error;
  }

  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return (await response.text()) as T;

  const payload = (await response.json()) as Envelope<T>;
  return payload.data;
}

function query(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, value);
  }
  const serialized = search.toString();
  return serialized ? `?${serialized}` : "";
}

export type ApiRange = "7d" | "30d" | "90d" | "365d";

export function toApiRange(days: number): ApiRange {
  return days >= 365 ? "365d" : days >= 90 ? "90d" : days >= 30 ? "30d" : "7d";
}

export const api = {
  auth: {
    csrf: () => request<{ csrfToken: string }>("/auth/csrf", { csrf: false }),
    me: () => request<MeResponse>("/auth/me"),
    login: async (input: { email: string; password: string; remember?: boolean }) => {
      const data = await request<LoginResponse>("/auth/login", {
        method: "POST",
        body: input,
      });
      setCsrfToken(data.csrfToken);
      return data;
    },
    googleLogin: async (input: { credential: string; remember?: boolean }) => {
      const data = await request<GoogleLoginResponse>("/auth/google", {
        method: "POST",
        body: input,
      });
      if ("signupRequired" in data) return data;
      setCsrfToken(data.csrfToken);
      return data;
    },
    googleSignup: async (input: {
      credential: string;
      username: string;
      remember?: boolean;
    }) => {
      const data = await request<LoginResponse>("/auth/google/signup", {
        method: "POST",
        body: input,
      });
      setCsrfToken(data.csrfToken);
      return data;
    },
    linkGoogle: (credential: string) =>
      request<{ connectedProviders: string[] }>("/auth/google/link", {
        method: "POST",
        body: { credential },
      }),
    unlinkGoogle: () =>
      request<void>("/auth/google", { method: "DELETE" }),
    logout: async () => {
      await request<void>("/auth/logout", { method: "POST" });
      setCsrfToken(null);
    },
    register: (input: {
      displayName: string;
      username: string;
      email: string;
      password: string;
      confirmPassword: string;
    }) =>
      request<{ message: string }>("/auth/register", {
        method: "POST",
        body: input,
      }),
    verifyEmail: (token: string) =>
      request<{ message: string }>("/auth/verify-email", {
        method: "POST",
        body: { token },
      }),
    verifyEmailChange: (token: string) =>
      request<{ message: string }>("/auth/verify-email-change", {
        method: "POST",
        body: { token },
      }),
    resendVerification: () =>
      request<{ message: string }>("/auth/resend-verification", {
        method: "POST",
      }),
    forgotPassword: (email: string) =>
      request<{ message: string }>("/auth/forgot-password", {
        method: "POST",
        body: { email },
      }),
    resetPassword: (token: string, password: string) =>
      request<{ message: string }>("/auth/reset-password", {
        method: "POST",
        body: { token, password },
      }),
  },

  contact: {
    send: (input: ContactValues) =>
      request<{ message: string }>("/contact", {
        method: "POST",
        body: input,
      }),
  },

  account: {
    get: () => request<ApiAccount>("/account"),
    changeEmail: (email: string, currentPassword: string) =>
      request<{ message: string }>("/account/email", {
        method: "PATCH",
        body: { email, currentPassword },
      }),
    cancelEmailChange: () =>
      request<void>("/account/email", { method: "DELETE" }),
    changePassword: (currentPassword: string | undefined, newPassword: string) =>
      request<void>("/account/password", {
        method: "PATCH",
        body: {
          ...(currentPassword ? { currentPassword } : {}),
          newPassword,
        },
      }),
    sessions: () => request<SessionSummary[]>("/account/sessions"),
    revokeSession: (id: string) =>
      request<void>(`/account/sessions/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    revokeOtherSessions: () =>
      request<void>("/account/sessions", { method: "DELETE" }),
    scheduleDeletion: (password: string, confirmUsername: string) =>
      request<{ deletionScheduledFor: string }>("/account", {
        method: "DELETE",
        body: { password, confirmUsername },
      }),
    cancelDeletion: () =>
      request<{ deletionScheduledFor: null }>("/account/cancel-deletion", {
        method: "POST",
      }),
    restore: (token: string) =>
      request<{ message: string }>("/account/restore", {
        method: "POST",
        body: { token },
      }),
  },

  profile: {
    get: () => request<ApiProfile>("/profile"),
    update: (
      input: Partial<
        Pick<
          Profile,
          "displayName" | "headline" | "username" | "bio" | "avatarUrl" | "socials"
        >
      > & { appearance?: AppearanceSettings },
    ) =>
      request<ApiProfile>("/profile", {
        method: "PATCH",
        body: input,
      }),
    publish: () => request<ApiProfile>("/profile/publish", { method: "POST" }),
    unpublish: () => request<ApiProfile>("/profile/unpublish", { method: "POST" }),
  },

  links: {
    list: () => request<Link[]>("/links"),
    create: (input: LinkFormValues) =>
      request<Link>("/links", { method: "POST", body: input }),
    update: (id: string, input: Partial<LinkFormValues>) =>
      request<Link>(`/links/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: input,
      }),
    setStatus: (id: string, isActive: boolean) =>
      request<Link>(`/links/${encodeURIComponent(id)}/status`, {
        method: "PATCH",
        body: { isActive },
      }),
    reorder: (ids: string[]) =>
      request<void>("/links/reorder", { method: "PUT", body: { ids } }),
    remove: (id: string) =>
      request<void>(`/links/${encodeURIComponent(id)}`, { method: "DELETE" }),
  },

  categories: {
    list: () => request<Array<Category & { linkCount: number }>>("/categories"),
    create: (input: CategoryFormValues) =>
      request<Category & { linkCount: number }>("/categories", {
        method: "POST",
        body: input,
      }),
    update: (id: string, input: Partial<CategoryFormValues>) =>
      request<Category & { linkCount: number }>(
        `/categories/${encodeURIComponent(id)}`,
        { method: "PATCH", body: input },
      ),
    reorder: (ids: string[]) =>
      request<void>("/categories/reorder", {
        method: "PUT",
        body: { ids },
      }),
    remove: (id: string) =>
      request<void>(`/categories/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
  },

  analytics: {
    overview: (range: ApiRange, linkId?: string) =>
      request<AnalyticsOverview>(
        `/analytics/overview${query({ range, linkId })}`,
      ),
    timeseries: (range: ApiRange, linkId?: string) =>
      request<TimeseriesResponse>(
        `/analytics/timeseries${query({ range, linkId })}`,
      ),
    breakdown: (
      range: ApiRange,
      dimension: "country" | "device" | "referrer",
      linkId?: string,
    ) =>
      request<BreakdownResponse>(
        `/analytics/breakdowns${query({ range, dimension, linkId })}`,
      ),
  },

  usernames: {
    availability: (username: string) =>
      request<AvailabilityResponse>(
        `/usernames/${encodeURIComponent(username)}/availability`,
      ),
  },

  export: {
    download: async (
      format: ExportFormat,
      include?: ExportSection[],
    ): Promise<ExportDownload> => {
      const params = new URLSearchParams({ format });
      if (format !== "profile" && include && include.length > 0 && include.length < 4) {
        params.set("include", include.join(","));
      }

      const response = await fetch(`${API_PREFIX}/export?${params.toString()}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) throw await parseError(response);

      const disposition = response.headers.get("content-disposition") ?? "";
      const filename =
        /filename="?([^";]+)"?/i.exec(disposition)?.[1] ??
        (format === "csv"
          ? "linkhub-export.zip"
          : format === "profile"
            ? "linkhub-profile.json"
            : "linkhub-export.json");

      return { blob: await response.blob(), filename };
    },
  },
};
