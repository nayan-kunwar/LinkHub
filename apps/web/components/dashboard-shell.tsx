"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  ChevronDown,
  Crown,
  Folder,
  LayoutDashboard,
  Link2,
  LogOut,
  Menu,
  Palette,
  Search,
  Settings,
  Upload,
  User,
  ExternalLink,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { LIMITS } from "@linkhub/shared";
import { useMockData } from "@/lib/store";
import { endDemoSession } from "@/lib/auth";
import { Avatar } from "./avatar";
import { Logo } from "./logo";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { cn } from "@/lib/utils";

const NAV_ITEMS: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/links", label: "Links", icon: Link2 },
  { href: "/dashboard/categories", label: "Categories", icon: Folder },
  { href: "/dashboard/appearance", label: "Appearance", icon: Palette },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/export", label: "Export", icon: Upload },
];

const ACCOUNT_ITEMS: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/dashboard/profile", label: "Profile", icon: User },
  { href: "/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function PlanCard() {
  const { state } = useMockData();
  const used = state.links.length;
  const percent = Math.min(100, Math.round((used / LIMITS.maxLinks) * 100));

  return (
    <div className="mt-auto rounded-2xl border border-line bg-violet-50/60 p-4">
      <p className="flex items-center gap-1.5 text-sm font-bold">
        <Crown aria-hidden="true" className="size-4 text-amber-500" />
        Free Plan
      </p>
      <p className="mt-1 text-xs text-zinc-700">
        {used} / {LIMITS.maxLinks} links
      </p>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-violet-100"
        role="progressbar"
        aria-label="Links used"
        aria-valuemin={0}
        aria-valuemax={LIMITS.maxLinks}
        aria-valuenow={used}
      >
        <div className="h-full rounded-full bg-violet-700 transition-[width]" style={{ width: `${percent}%` }} />
      </div>
      <button
        type="button"
        disabled
        aria-disabled="true"
        className="mt-3 w-full cursor-not-allowed rounded-lg bg-violet-100 py-2 text-sm font-semibold text-violet-900"
      >
        Upgrade (Soon)
      </button>
    </div>
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  const renderItem = (item: { href: string; label: string; icon: LucideIcon }) => {
    const active = isActive(pathname, item.href);
    const Icon = item.icon;
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          onClick={onNavigate}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
            active
              ? "bg-violet-100 font-semibold text-violet-900"
              : "text-zinc-700 hover:bg-violet-50 hover:text-violet-900",
          )}
        >
          <Icon aria-hidden="true" className="size-5 shrink-0" strokeWidth={1.8} />
          {item.label}
        </Link>
      </li>
    );
  };

  return (
    <nav aria-label="Dashboard" className="flex h-full flex-col">
      <ul className="space-y-1">{NAV_ITEMS.map(renderItem)}</ul>
      <div className="my-3 h-px bg-line" role="separator" />
      <ul className="space-y-1">{ACCOUNT_ITEMS.map(renderItem)}</ul>
      <PlanCard />
    </nav>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { state } = useMockData();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  const signOut = () => {
    endDemoSession();
    router.push("/login");
  };

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const term = query.trim();
    router.push(term ? `/dashboard/links?q=${encodeURIComponent(term)}` : "/dashboard/links");
  };

  return (
    <div className="min-h-screen bg-canvas text-zinc-900">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-violet-800 focus:shadow-lg"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-line bg-white px-4 sm:px-5">
        <button
          type="button"
          className="inline-flex size-9 items-center justify-center rounded-lg text-zinc-700 transition hover:bg-violet-50 hover:text-violet-900 focus-visible:ring-4 focus-visible:ring-violet-200 lg:hidden"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open navigation menu"
        >
          <Menu className="size-5" />
        </button>

        <Logo className="shrink-0 text-lg lg:w-60 lg:text-xl" iconClassName="size-6 lg:size-7" />

        <form role="search" className="ml-1 hidden max-w-md flex-1 md:block" onSubmit={submitSearch}>
          <label htmlFor="global-search" className="sr-only">
            Search links and categories
          </label>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500"
            />
            <input
              id="global-search"
              name="q"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search links, categories…"
              className="h-9 w-full rounded-lg border border-zinc-300 bg-zinc-50 pl-9 pr-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-500 hover:border-zinc-400 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
            />
          </div>
        </form>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <Button asChild variant="secondary" size="sm" className="hidden sm:inline-flex">
            <Link href={`/${state.profile.username}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4" />
              View public profile
            </Link>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 text-left transition hover:bg-violet-50 focus-visible:ring-4 focus-visible:ring-violet-200"
                aria-label="Account menu"
              >
                <Avatar
                  name={state.profile.displayName}
                  src={state.profile.avatarUrl}
                  className="size-8 text-xs"
                  ring={false}
                />
                <span className="hidden max-w-36 truncate text-sm font-semibold text-zinc-900 sm:block">
                  {state.profile.displayName}
                </span>
                <ChevronDown aria-hidden="true" className="hidden size-4 text-zinc-600 sm:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem asChild>
                <Link href="/dashboard/profile">
                  <User className="size-4" /> Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <Settings className="size-4" /> Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={signOut} destructive>
                <LogOut className="size-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-4rem)]">
        <aside
          className="sticky top-16 hidden h-[calc(100vh-4rem)] w-60 shrink-0 flex-col overflow-y-auto border-r border-line bg-white px-4 py-5 lg:flex"
          aria-label="Sidebar"
        >
          <SidebarNav />
        </aside>

        <div className="min-w-0 flex-1">{children}</div>
      </div>

      <Dialog open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <DialogContent
          hideClose
          className="left-0 top-0 h-dvh max-h-none w-72 max-w-[85vw] translate-x-0 translate-y-0 rounded-none border-0 p-0 data-[state=open]:animate-none"
        >
          <DialogTitle className="sr-only">Dashboard navigation</DialogTitle>
          <div className="flex h-16 items-center justify-between border-b border-line px-4">
            <Logo href={null} className="text-lg" iconClassName="size-6" />
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="inline-flex size-9 items-center justify-center rounded-lg text-zinc-700 hover:bg-violet-50 focus-visible:ring-4 focus-visible:ring-violet-200"
              aria-label="Close navigation menu"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="flex h-[calc(100dvh-4rem)] flex-col px-4 py-5">
            <SidebarNav onNavigate={() => setMobileNavOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
