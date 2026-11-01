"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { EMPTY_LINK_METADATA, LIMITS } from "@linkhub/shared";
import type {
  AppearanceSettings,
  Category,
  CategoryFormValues,
  Link,
  LinkFormValues,
  Profile,
  ProfileInput,
} from "@linkhub/shared";
import {
  ApiError,
  api,
  type ApiAccount,
  type ApiProfile,
} from "./api-client";
import { invalidateAnalyticsCache } from "./analytics";
import {
  EMPTY_ACCOUNT,
  EMPTY_PROFILE,
  createEmptyState,
  type AppAccount,
  type AppState,
} from "./app-state";

export type LoadStatus =
  | "loading"
  | "authenticated"
  | "anonymous"
  | "pending"
  | "error";

export interface MutationResult {
  ok: boolean;
  error?: ApiError;
}

export type GoogleLoginOutcome =
  | { status: "authenticated" }
  | {
      status: "signup_required";
      email: string;
      displayName: string;
      suggestedUsername: string;
    }
  | { status: "error"; error?: ApiError };

interface AppDataContextValue {
  state: AppState;
  hydrated: boolean;
  status: LoadStatus;
  loadError: string | null;
  refresh: () => Promise<void>;
  login: (input: {
    email: string;
    password: string;
    remember?: boolean;
  }) => Promise<MutationResult>;
  loginWithGoogle: (input: {
    credential: string;
    remember?: boolean;
  }) => Promise<GoogleLoginOutcome>;
  signupWithGoogle: (input: {
    credential: string;
    username: string;
    remember?: boolean;
  }) => Promise<MutationResult>;
  linkGoogle: (credential: string) => Promise<MutationResult>;
  unlinkGoogle: () => Promise<boolean>;
  logout: () => Promise<void>;
  addLink: (values: LinkFormValues) => Promise<boolean>;
  updateLink: (id: string, values: LinkFormValues) => Promise<boolean>;
  refreshLinkMetadata: (
    id: string,
    signal?: AbortSignal,
  ) => Promise<Link | null>;
  deleteLink: (id: string) => Promise<boolean>;
  toggleLink: (id: string) => Promise<boolean>;
  reorderLinks: (activeId: string, overId: string) => Promise<boolean>;
  addCategory: (values: CategoryFormValues) => Promise<boolean>;
  updateCategory: (id: string, values: CategoryFormValues) => Promise<boolean>;
  deleteCategory: (id: string) => Promise<boolean>;
  toggleCategory: (id: string) => Promise<boolean>;
  reorderCategories: (activeId: string, overId: string) => Promise<boolean>;
  updateProfile: (values: ProfileInput) => Promise<MutationResult>;
  setPublished: (published: boolean) => Promise<boolean>;
  setAppearance: (appearance: AppearanceSettings) => Promise<boolean>;
  requestEmailChange: (
    email: string,
    currentPassword: string,
  ) => Promise<MutationResult>;
  cancelPendingEmail: () => Promise<boolean>;
  changePassword: (
    currentPassword: string | undefined,
    newPassword: string,
  ) => Promise<MutationResult>;
  removeSession: (id: string) => Promise<boolean>;
  removeOtherSessions: () => Promise<boolean>;
  scheduleDeletion: (
    password: string,
    confirmUsername: string,
  ) => Promise<MutationResult>;
  restoreAccount: () => Promise<boolean>;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

function toProfile(profile: ApiProfile): Profile {
  const { appearance: _appearance, ...rest } = profile;
  return rest;
}

function toAccount(account: ApiAccount): AppAccount {
  return {
    id: account.id,
    email: account.email,
    emailVerified: account.emailVerified,
    pendingEmail: account.pendingEmail,
    plan: account.plan,
    status: account.status,
    createdAt: account.createdAt,
    deletionScheduledFor: account.deletionScheduledFor,
    connectedProviders: account.connectedProviders ?? [],
    hasPassword: account.hasPassword ?? false,
  };
}

function applyProfile(current: AppState, profile: ApiProfile): AppState {
  return {
    ...current,
    profile: toProfile(profile),
    appearance: profile.appearance,
  };
}

function withSortOrder<T extends { id: string; sortOrder: number }>(items: T[]): T[] {
  return items.map((item, index) => ({ ...item, sortOrder: index }));
}

function moveItem<T extends { id: string }>(
  items: T[],
  activeId: string,
  overId: string,
): T[] {
  const from = items.findIndex((item) => item.id === activeId);
  const to = items.findIndex((item) => item.id === overId);
  if (from === -1 || to === -1 || from === to) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

function normalizeError(error: unknown, fallback: string): ApiError {
  if (error instanceof ApiError) return error;
  return new ApiError(
    0,
    "INTERNAL_ERROR",
    error instanceof Error && error.message ? error.message : fallback,
  );
}

function formatFieldErrors(details: unknown): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!Array.isArray(details)) return errors;
  for (const detail of details) {
    if (!detail || typeof detail !== "object") continue;
    const item = detail as { path?: unknown; message?: unknown };
    if (typeof item.message !== "string") continue;
    const key = Array.isArray(item.path)
      ? item.path.join(".")
      : typeof item.path === "string"
        ? item.path
        : "";
    if (key && !errors[key]) errors[key] = item.message;
  }
  return errors;
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => createEmptyState());
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    setLoadError(null);

    try {
      await api.auth.csrf().catch(() => undefined);
      const me = await api.auth.me();

      if (me.user.status === "pending_verification") {
        setState({
          ...createEmptyState(),
          profile: me.profile ? toProfile(me.profile) : { ...EMPTY_PROFILE },
          appearance: me.profile?.appearance ?? createEmptyState().appearance,
          account: toAccount(me.user),
        });
        setStatus("pending");
        return;
      }

      const [links, categories, account, sessions] = await Promise.all([
        api.links.list(),
        api.categories.list(),
        api.account.get(),
        api.account.sessions(),
      ]);

      setState({
        profile: me.profile ? toProfile(me.profile) : { ...EMPTY_PROFILE },
        appearance: me.profile?.appearance ?? createEmptyState().appearance,
        account: toAccount(account),
        categories,
        links,
        sessions,
      });
      setStatus("authenticated");
    } catch (error) {
      const apiError = normalizeError(error, "Could not load your account.");
      if (apiError.status === 401) {
        setState(createEmptyState());
        setStatus("anonymous");
      } else if (
        apiError.status === 403 &&
        apiError.code === "EMAIL_NOT_VERIFIED"
      ) {
        setStatus("pending");
      } else {
        setLoadError(apiError.message);
        setStatus("error");
      }
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const failMutation = useCallback(
    (error: unknown, fallback: string, notify = true): MutationResult => {
      const apiError = normalizeError(error, fallback);
      if (apiError.status === 401 && apiError.code === "UNAUTHENTICATED") {
        setState(createEmptyState());
        setStatus("anonymous");
        if (notify) toast.error("Your session expired. Sign in again.");
      } else if (notify) {
        toast.error(apiError.message);
      }
      return { ok: false, error: apiError };
    },
    [],
  );

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  const login = useCallback(
    async (input: { email: string; password: string; remember?: boolean }) => {
      try {
        await api.auth.login(input);
        await load();
        return { ok: true };
      } catch (error) {
        return failMutation(error, "Sign in failed.", false);
      }
    },
    [failMutation, load],
  );

  const loginWithGoogle = useCallback(
    async (input: {
      credential: string;
      remember?: boolean;
    }): Promise<GoogleLoginOutcome> => {
      try {
        const result = await api.auth.googleLogin(input);
        if ("signupRequired" in result) {
          return {
            status: "signup_required",
            email: result.email,
            displayName: result.displayName,
            suggestedUsername: result.suggestedUsername,
          };
        }
        await load();
        return { status: "authenticated" };
      } catch (error) {
        const failure = failMutation(error, "Google sign-in failed.", false);
        return { status: "error", error: failure.error };
      }
    },
    [failMutation, load],
  );

  const signupWithGoogle = useCallback(
    async (input: {
      credential: string;
      username: string;
      remember?: boolean;
    }) => {
      try {
        await api.auth.googleSignup(input);
        await load();
        return { ok: true };
      } catch (error) {
        return failMutation(error, "Could not create your Link Hub.", false);
      }
    },
    [failMutation, load],
  );

  const linkGoogle = useCallback(
    async (credential: string) => {
      try {
        const result = await api.auth.linkGoogle(credential);
        setState((current) => ({
          ...current,
          account: {
            ...current.account,
            connectedProviders: result.connectedProviders,
          },
        }));
        return { ok: true };
      } catch (error) {
        return failMutation(error, "Could not connect Google.", false);
      }
    },
    [failMutation],
  );

  const unlinkGoogle = useCallback(async () => {
    try {
      await api.auth.unlinkGoogle();
      setState((current) => ({
        ...current,
        account: {
          ...current.account,
          connectedProviders: current.account.connectedProviders.filter(
            (provider) => provider !== "google",
          ),
        },
      }));
      return true;
    } catch (error) {
      failMutation(error, "Could not disconnect Google.");
      return false;
    }
  }, [failMutation]);

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      // The local state is cleared even if the API is unreachable.
    }
    invalidateAnalyticsCache();
    setState(createEmptyState());
    setStatus("anonymous");
    setHydrated(true);
  }, []);

  const addLink = useCallback(
    async (values: LinkFormValues) => {
      const temporary: Link = {
        id: crypto.randomUUID(),
        title: values.title,
        url: values.url,
        type: values.type,
        config: values.config,
        metadata: { ...EMPTY_LINK_METADATA },
        previewImageUrl: "",
        description: values.description,
        categoryId: values.categoryId,
        icon: values.icon,
        isActive: values.isActive,
        sortOrder: state.links.length,
        createdAt: new Date().toISOString(),
      };

      setState((current) => ({
        ...current,
        links: [...current.links, temporary],
      }));

      try {
        const created = await api.links.create(values);
        setState((current) => ({
          ...current,
          links: current.links.map((link) =>
            link.id === temporary.id ? created : link,
          ),
        }));
        invalidateAnalyticsCache();
        return true;
      } catch (error) {
        setState((current) => ({
          ...current,
          links: current.links.filter((link) => link.id !== temporary.id),
        }));
        failMutation(error, "Could not add the link.");
        return false;
      }
    },
    [failMutation, state.links.length],
  );

  const updateLink = useCallback(
    async (id: string, values: LinkFormValues) => {
      const previous = state.links.find((link) => link.id === id);
      if (!previous) return false;

      setState((current) => ({
        ...current,
        links: current.links.map((link) =>
          link.id === id ? { ...link, ...values } : link,
        ),
      }));

      try {
        const updated = await api.links.update(id, values);
        setState((current) => ({
          ...current,
          links: current.links.map((link) => (link.id === id ? updated : link)),
        }));
        invalidateAnalyticsCache();
        return true;
      } catch (error) {
        setState((current) => ({
          ...current,
          links: current.links.map((link) =>
            link.id === id ? previous : link,
          ),
        }));
        failMutation(error, "Could not update the link.");
        return false;
      }
    },
    [failMutation, state.links],
  );

  const refreshLinkMetadata = useCallback(
    async (id: string, signal?: AbortSignal) => {
      try {
        const updated = await api.links.refreshMetadata(id, signal);
        setState((current) => ({
          ...current,
          links: current.links.map((link) =>
            link.id === id ? updated : link,
          ),
        }));
        return updated;
      } catch (error) {
        if (signal?.aborted) return null;
        failMutation(error, "Could not refresh the preview.");
        return null;
      }
    },
    [failMutation],
  );

  const deleteLink = useCallback(
    async (id: string) => {
      const previous = state.links.find((link) => link.id === id);
      if (!previous) return false;

      setState((current) => ({
        ...current,
        links: current.links.filter((link) => link.id !== id),
      }));

      try {
        await api.links.remove(id);
        invalidateAnalyticsCache();
        return true;
      } catch (error) {
        setState((current) => {
          if (current.links.some((link) => link.id === id)) return current;
          const next = [...current.links, previous].sort(
            (left, right) => left.sortOrder - right.sortOrder,
          );
          return { ...current, links: withSortOrder(next) };
        });
        failMutation(error, "Could not delete the link.");
        return false;
      }
    },
    [failMutation, state.links],
  );

  const toggleLink = useCallback(
    async (id: string) => {
      const previous = state.links.find((link) => link.id === id);
      if (!previous) return false;

      setState((current) => ({
        ...current,
        links: current.links.map((link) =>
          link.id === id ? { ...link, isActive: !link.isActive } : link,
        ),
      }));

      try {
        const updated = await api.links.setStatus(id, !previous.isActive);
        setState((current) => ({
          ...current,
          links: current.links.map((link) => (link.id === id ? updated : link)),
        }));
        invalidateAnalyticsCache();
        return true;
      } catch (error) {
        setState((current) => ({
          ...current,
          links: current.links.map((link) => (link.id === id ? previous : link)),
        }));
        failMutation(error, "Could not change the link status.");
        return false;
      }
    },
    [failMutation, state.links],
  );

  const reorderLinks = useCallback(
    async (activeId: string, overId: string) => {
      const previousLinks = state.links;
      const moved = moveItem(previousLinks, activeId, overId);
      if (moved === previousLinks) return true;
      const nextLinks = withSortOrder(moved);

      setState((current) => ({ ...current, links: nextLinks }));

      try {
        await api.links.reorder(nextLinks.map((link) => link.id));
        invalidateAnalyticsCache();
        return true;
      } catch (error) {
        setState((current) => ({ ...current, links: previousLinks }));
        failMutation(error, "Could not save the new order.");
        return false;
      }
    },
    [failMutation, state.links],
  );

  const addCategory = useCallback(
    async (values: CategoryFormValues) => {
      const temporary: Category = {
        id: crypto.randomUUID(),
        name: values.name,
        description: values.description,
        color: values.color,
        icon: values.icon,
        isVisible: values.isVisible,
        sortOrder: state.categories.length,
      };

      setState((current) => ({
        ...current,
        categories: [...current.categories, temporary],
      }));

      try {
        const created = await api.categories.create(values);
        setState((current) => ({
          ...current,
          categories: current.categories.map((category) =>
            category.id === temporary.id ? created : category,
          ),
        }));
        return true;
      } catch (error) {
        setState((current) => ({
          ...current,
          categories: current.categories.filter(
            (category) => category.id !== temporary.id,
          ),
        }));
        failMutation(error, "Could not add the category.");
        return false;
      }
    },
    [failMutation, state.categories.length],
  );

  const updateCategory = useCallback(
    async (id: string, values: CategoryFormValues) => {
      const previous = state.categories.find((category) => category.id === id);
      if (!previous) return false;

      setState((current) => ({
        ...current,
        categories: current.categories.map((category) =>
          category.id === id ? { ...category, ...values } : category,
        ),
      }));

      try {
        const updated = await api.categories.update(id, values);
        setState((current) => ({
          ...current,
          categories: current.categories.map((category) =>
            category.id === id ? updated : category,
          ),
        }));
        return true;
      } catch (error) {
        setState((current) => ({
          ...current,
          categories: current.categories.map((category) =>
            category.id === id ? previous : category,
          ),
        }));
        failMutation(error, "Could not update the category.");
        return false;
      }
    },
    [failMutation, state.categories],
  );

  const deleteCategory = useCallback(
    async (id: string) => {
      const previous = state;
      if (!previous.categories.some((category) => category.id === id)) return false;

      setState((current) => ({
        ...current,
        categories: withSortOrder(
          current.categories.filter((category) => category.id !== id),
        ),
        links: current.links.map((link) =>
          link.categoryId === id ? { ...link, categoryId: null } : link,
        ),
      }));

      try {
        await api.categories.remove(id);
        return true;
      } catch (error) {
        setState(previous);
        failMutation(error, "Could not delete the category.");
        return false;
      }
    },
    [failMutation, state],
  );

  const toggleCategory = useCallback(
    async (id: string) => {
      const previous = state.categories.find((category) => category.id === id);
      if (!previous) return false;

      setState((current) => ({
        ...current,
        categories: current.categories.map((category) =>
          category.id === id
            ? { ...category, isVisible: !category.isVisible }
            : category,
        ),
      }));

      try {
        const updated = await api.categories.update(id, {
          isVisible: !previous.isVisible,
        });
        setState((current) => ({
          ...current,
          categories: current.categories.map((category) =>
            category.id === id ? updated : category,
          ),
        }));
        return true;
      } catch (error) {
        setState((current) => ({
          ...current,
          categories: current.categories.map((category) =>
            category.id === id ? previous : category,
          ),
        }));
        failMutation(error, "Could not change the category visibility.");
        return false;
      }
    },
    [failMutation, state.categories],
  );

  const reorderCategories = useCallback(
    async (activeId: string, overId: string) => {
      const previousCategories = state.categories;
      const moved = moveItem(previousCategories, activeId, overId);
      if (moved === previousCategories) return true;
      const nextCategories = withSortOrder(moved);

      setState((current) => ({ ...current, categories: nextCategories }));

      try {
        await api.categories.reorder(nextCategories.map((category) => category.id));
        return true;
      } catch (error) {
        setState((current) => ({
          ...current,
          categories: previousCategories,
        }));
        failMutation(error, "Could not save the category order.");
        return false;
      }
    },
    [failMutation, state.categories],
  );

  const updateProfile = useCallback(
    async (values: ProfileInput) => {
      const previous = state;
      const { isPublished, ...fields } = values;

      setState((current) => ({
        ...current,
        profile: { ...current.profile, ...values },
      }));

      try {
        let updated = await api.profile.update(fields);
        setState((current) => applyProfile(current, updated));

        if (isPublished !== previous.profile.isPublished) {
          try {
            updated = isPublished
              ? await api.profile.publish()
              : await api.profile.unpublish();
            setState((current) => applyProfile(current, updated));
          } catch (error) {
            return failMutation(error, "Profile saved, but publishing failed.", false);
          }
        }

        return { ok: true };
      } catch (error) {
        setState(previous);
        return failMutation(error, "Could not save your profile.", false);
      }
    },
    [failMutation, state],
  );

  const setPublished = useCallback(
    async (published: boolean) => {
      const previous = state;
      setState((current) => ({
        ...current,
        profile: { ...current.profile, isPublished: published },
      }));

      try {
        const updated = published
          ? await api.profile.publish()
          : await api.profile.unpublish();
        setState((current) => applyProfile(current, updated));
        return true;
      } catch (error) {
        setState(previous);
        failMutation(error, "Could not change the published state.");
        return false;
      }
    },
    [failMutation, state],
  );

  const setAppearance = useCallback(
    async (appearance: AppearanceSettings) => {
      const previous = state;
      setState((current) => ({ ...current, appearance }));

      try {
        const updated = await api.profile.update({ appearance });
        setState((current) => applyProfile(current, updated));
        return true;
      } catch (error) {
        setState(previous);
        failMutation(error, "Could not save your appearance.");
        return false;
      }
    },
    [failMutation, state],
  );

  const requestEmailChange = useCallback(
    async (email: string, currentPassword: string) => {
      try {
        await api.account.changeEmail(email, currentPassword);
        const account = await api.account.get().catch(() => null);
        if (account) {
          setState((current) => ({
            ...current,
            account: toAccount(account),
          }));
        }
        return { ok: true };
      } catch (error) {
        return failMutation(error, "Could not request an email change.", false);
      }
    },
    [failMutation],
  );

  const cancelPendingEmail = useCallback(async () => {
    try {
      await api.account.cancelEmailChange();
      setState((current) => ({
        ...current,
        account: { ...current.account, pendingEmail: null },
      }));
      return true;
    } catch (error) {
      failMutation(error, "Could not cancel the email change.");
      return false;
    }
  }, [failMutation]);

  const changePassword = useCallback(
    async (currentPassword: string | undefined, newPassword: string) => {
      try {
        await api.account.changePassword(currentPassword, newPassword);
        setState((current) => ({
          ...current,
          account: { ...current.account, hasPassword: true },
        }));
        const sessions = await api.account.sessions().catch(() => null);
        if (sessions) {
          setState((current) => ({ ...current, sessions }));
        }
        return { ok: true };
      } catch (error) {
        return failMutation(error, "Could not update your password.", false);
      }
    },
    [failMutation],
  );

  const removeSession = useCallback(
    async (id: string) => {
      try {
        await api.account.revokeSession(id);
        setState((current) => ({
          ...current,
          sessions: current.sessions.filter(
            (session) => session.id !== id || session.current,
          ),
        }));
        return true;
      } catch (error) {
        failMutation(error, "Could not sign out that session.");
        return false;
      }
    },
    [failMutation],
  );

  const removeOtherSessions = useCallback(async () => {
    try {
      await api.account.revokeOtherSessions();
      setState((current) => ({
        ...current,
        sessions: current.sessions.filter((session) => session.current),
      }));
      return true;
    } catch (error) {
      failMutation(error, "Could not sign out other sessions.");
      return false;
    }
  }, [failMutation]);

  const scheduleDeletion = useCallback(
    async (password: string, confirmUsername: string) => {
      try {
        const result = await api.account.scheduleDeletion(password, confirmUsername);
        setState((current) => ({
          ...current,
          account: {
            ...current.account,
            deletionScheduledFor: result.deletionScheduledFor,
          },
          profile: { ...current.profile, isPublished: false },
        }));
        return { ok: true };
      } catch (error) {
        return failMutation(error, "Could not schedule account deletion.", false);
      }
    },
    [failMutation],
  );

  const restoreAccount = useCallback(async () => {
    try {
      await api.account.cancelDeletion();
      setState((current) => ({
        ...current,
        account: { ...current.account, deletionScheduledFor: null },
      }));
      return true;
    } catch (error) {
      failMutation(error, "Could not restore your account.");
      return false;
    }
  }, [failMutation]);

  const value = useMemo<AppDataContextValue>(
    () => ({
      state,
      hydrated,
      status,
      loadError,
      refresh,
      login,
      loginWithGoogle,
      signupWithGoogle,
      linkGoogle,
      unlinkGoogle,
      logout,
      addLink,
      updateLink,
      refreshLinkMetadata,
      deleteLink,
      toggleLink,
      reorderLinks,
      addCategory,
      updateCategory,
      deleteCategory,
      toggleCategory,
      reorderCategories,
      updateProfile,
      setPublished,
      setAppearance,
      requestEmailChange,
      cancelPendingEmail,
      changePassword,
      removeSession,
      removeOtherSessions,
      scheduleDeletion,
      restoreAccount,
    }),
    [
      state,
      hydrated,
      status,
      loadError,
      refresh,
      login,
      loginWithGoogle,
      signupWithGoogle,
      linkGoogle,
      unlinkGoogle,
      logout,
      addLink,
      updateLink,
      refreshLinkMetadata,
      deleteLink,
      toggleLink,
      reorderLinks,
      addCategory,
      updateCategory,
      deleteCategory,
      toggleCategory,
      reorderCategories,
      updateProfile,
      setPublished,
      setAppearance,
      requestEmailChange,
      cancelPendingEmail,
      changePassword,
      removeSession,
      removeOtherSessions,
      scheduleDeletion,
      restoreAccount,
    ],
  );

  return (
    <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
  );
}

export function useAppData(): AppDataContextValue {
  const context = useContext(AppDataContext);
  if (!context) throw new Error("useAppData must be used inside AppDataProvider");
  return context;
}

export function useAppState(): AppState {
  return useAppData().state;
}

export { EMPTY_ACCOUNT, EMPTY_PROFILE, formatFieldErrors, LIMITS };
