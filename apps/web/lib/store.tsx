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
import type {
  AppearanceSettings,
  Category,
  CategoryFormValues,
  LinkFormValues,
  ProfileInput,
} from "@linkhub/shared";
import { LIMITS } from "@linkhub/shared";
import {
  createEmptyState,
  createId,
  type MockLink,
  type MockState,
} from "./mock-data";

const STORAGE_KEY = "linkhub-demo-v2";

interface MockDataContextValue {
  state: MockState;
  hydrated: boolean;
  addLink: (values: LinkFormValues) => MockLink;
  updateLink: (id: string, values: LinkFormValues) => void;
  deleteLink: (id: string) => void;
  toggleLink: (id: string) => void;
  reorderLinks: (activeId: string, overId: string) => void;
  addCategory: (values: CategoryFormValues) => Category;
  updateCategory: (id: string, values: CategoryFormValues) => void;
  deleteCategory: (id: string) => void;
  toggleCategory: (id: string) => void;
  reorderCategories: (activeId: string, overId: string) => void;
  updateProfile: (values: ProfileInput) => void;
  setAppearance: (appearance: AppearanceSettings) => void;
  resetAppearance: () => void;
  setPendingEmail: (email: string) => void;
  cancelPendingEmail: () => void;
  removeSession: (id: string) => void;
  removeOtherSessions: () => void;
  scheduleDeletion: () => void;
  restoreAccount: () => void;
  resetDemoData: () => void;
}

const MockDataContext = createContext<MockDataContextValue | null>(null);

function normalizeState(candidate: Partial<MockState>): MockState {
  const fallback = createEmptyState();
  if (!candidate || candidate.version !== 2) return fallback;
  return {
    ...fallback,
    ...candidate,
    profile: { ...fallback.profile, ...candidate.profile, socials: { ...fallback.profile.socials, ...candidate.profile?.socials } },
    account: { ...fallback.account, ...candidate.account },
    appearance: { ...fallback.appearance, ...candidate.appearance },
    categories: candidate.categories?.length ? candidate.categories : fallback.categories,
    links: candidate.links ?? fallback.links,
    sessions: candidate.sessions ?? fallback.sessions,
  };
}

function withSortOrder<T extends { id: string; sortOrder: number }>(items: T[]): T[] {
  return items.map((item, index) => ({ ...item, sortOrder: index }));
}

function moveItem<T extends { id: string }>(items: T[], activeId: string, overId: string): T[] {
  const from = items.findIndex((item) => item.id === activeId);
  const to = items.findIndex((item) => item.id === overId);
  if (from === -1 || to === -1 || from === to) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function MockDataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MockState>(() => createEmptyState());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setState(normalizeState(JSON.parse(raw) as Partial<MockState>));
    } catch {
      // A corrupt preview payload should never block the UI.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore quota/private-mode failures in the preview.
    }
  }, [state, hydrated]);

  const addLink = useCallback((values: LinkFormValues) => {
    const link: MockLink = {
      id: createId("a"),
      title: values.title,
      url: values.url,
      description: values.description,
      categoryId: values.categoryId,
      icon: values.icon,
      isActive: values.isActive,
      sortOrder: 0,
      createdAt: new Date().toISOString(),
      baseWeight: 0,
    };
    setState((current) => {
      if (current.links.length >= LIMITS.maxLinks) return current;
      const next = withSortOrder([...current.links, link]);
      return { ...current, links: next };
    });
    return link;
  }, []);

  const updateLink = useCallback((id: string, values: LinkFormValues) => {
    setState((current) => ({
      ...current,
      links: current.links.map((link) => (link.id === id ? { ...link, ...values } : link)),
    }));
  }, []);

  const deleteLink = useCallback((id: string) => {
    setState((current) => ({
      ...current,
      links: withSortOrder(current.links.filter((link) => link.id !== id)),
    }));
  }, []);

  const toggleLink = useCallback((id: string) => {
    setState((current) => ({
      ...current,
      links: current.links.map((link) =>
        link.id === id ? { ...link, isActive: !link.isActive } : link,
      ),
    }));
  }, []);

  const reorderLinks = useCallback((activeId: string, overId: string) => {
    setState((current) => {
      const next = moveItem(current.links, activeId, overId);
      return next === current.links ? current : { ...current, links: withSortOrder(next) };
    });
  }, []);

  const addCategory = useCallback((values: CategoryFormValues) => {
    const category: Category = {
      id: createId("c"),
      name: values.name,
      description: values.description,
      color: values.color,
      icon: values.icon,
      isVisible: values.isVisible,
      sortOrder: 0,
    };
    setState((current) => {
      if (current.categories.length >= LIMITS.maxCategories) return current;
      return { ...current, categories: withSortOrder([...current.categories, category]) };
    });
    return category;
  }, []);

  const updateCategory = useCallback((id: string, values: CategoryFormValues) => {
    setState((current) => ({
      ...current,
      categories: current.categories.map((category) =>
        category.id === id ? { ...category, ...values } : category,
      ),
    }));
  }, []);

  const deleteCategory = useCallback((id: string) => {
    setState((current) => ({
      ...current,
      categories: withSortOrder(current.categories.filter((category) => category.id !== id)),
      links: current.links.map((link) =>
        link.categoryId === id ? { ...link, categoryId: null } : link,
      ),
    }));
  }, []);

  const toggleCategory = useCallback((id: string) => {
    setState((current) => ({
      ...current,
      categories: current.categories.map((category) =>
        category.id === id ? { ...category, isVisible: !category.isVisible } : category,
      ),
    }));
  }, []);

  const reorderCategories = useCallback((activeId: string, overId: string) => {
    setState((current) => {
      const next = moveItem(current.categories, activeId, overId);
      return next === current.categories
        ? current
        : { ...current, categories: withSortOrder(next) };
    });
  }, []);

  const updateProfile = useCallback((values: ProfileInput) => {
    setState((current) => ({
      ...current,
      profile: {
        ...current.profile,
        displayName: values.displayName,
        headline: values.headline,
        username: values.username,
        bio: values.bio,
        avatarUrl: values.avatarUrl,
        socials: values.socials,
        isPublished: values.isPublished,
      },
    }));
  }, []);

  const setAppearance = useCallback((appearance: AppearanceSettings) => {
    setState((current) => ({ ...current, appearance }));
  }, []);

  const resetAppearance = useCallback(() => {
    setState((current) => ({ ...current, appearance: createEmptyState().appearance }));
  }, []);

  const setPendingEmail = useCallback((email: string) => {
    setState((current) => ({
      ...current,
      account: { ...current.account, pendingEmail: email },
    }));
  }, []);

  const cancelPendingEmail = useCallback(() => {
    setState((current) => ({
      ...current,
      account: { ...current.account, pendingEmail: null },
    }));
  }, []);

  const removeSession = useCallback((id: string) => {
    setState((current) => ({
      ...current,
      sessions: current.sessions.filter((session) => session.id !== id || session.current),
    }));
  }, []);

  const removeOtherSessions = useCallback(() => {
    setState((current) => ({
      ...current,
      sessions: current.sessions.filter((session) => session.current),
    }));
  }, []);

  const scheduleDeletion = useCallback(() => {
    const deletionDate = new Date();
    deletionDate.setUTCDate(deletionDate.getUTCDate() + LIMITS.deleteGraceDays);
    setState((current) => ({
      ...current,
      account: { ...current.account, deletionScheduledFor: deletionDate.toISOString() },
      profile: { ...current.profile, isPublished: false },
    }));
  }, []);

  const restoreAccount = useCallback(() => {
    setState((current) => ({
      ...current,
      account: { ...current.account, deletionScheduledFor: null },
    }));
  }, []);

  const resetDemoData = useCallback(() => {
    const fresh = createEmptyState();
    setState(fresh);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  }, []);

  const value = useMemo<MockDataContextValue>(
    () => ({
      state,
      hydrated,
      addLink,
      updateLink,
      deleteLink,
      toggleLink,
      reorderLinks,
      addCategory,
      updateCategory,
      deleteCategory,
      toggleCategory,
      reorderCategories,
      updateProfile,
      setAppearance,
      resetAppearance,
      setPendingEmail,
      cancelPendingEmail,
      removeSession,
      removeOtherSessions,
      scheduleDeletion,
      restoreAccount,
      resetDemoData,
    }),
    [
      state,
      hydrated,
      addLink,
      updateLink,
      deleteLink,
      toggleLink,
      reorderLinks,
      addCategory,
      updateCategory,
      deleteCategory,
      toggleCategory,
      reorderCategories,
      updateProfile,
      setAppearance,
      resetAppearance,
      setPendingEmail,
      cancelPendingEmail,
      removeSession,
      removeOtherSessions,
      scheduleDeletion,
      restoreAccount,
      resetDemoData,
    ],
  );

  return <MockDataContext.Provider value={value}>{children}</MockDataContext.Provider>;
}

export function useMockData(): MockDataContextValue {
  const context = useContext(MockDataContext);
  if (!context) throw new Error("useMockData must be used inside MockDataProvider");
  return context;
}

export function useMockState(): MockState {
  return useMockData().state;
}
