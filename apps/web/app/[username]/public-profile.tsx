"use client";

import Link from "next/link";
import { ArrowRight, Link2Off } from "lucide-react";
import { ProfileView } from "@/components/profile-view";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { useMockData } from "@/lib/store";

function ProfileSkeleton() {
  return (
    <div className="min-h-screen bg-[#f7f5ff]">
      <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center px-5 py-16">
        <div className="size-24 animate-pulse rounded-full bg-violet-200" aria-hidden="true" />
        <div className="mt-4 h-5 w-40 animate-pulse rounded bg-violet-200" aria-hidden="true" />
        <div className="mt-2 h-4 w-28 animate-pulse rounded bg-violet-100" aria-hidden="true" />
        <div className="mt-8 w-full space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-14 animate-pulse rounded-2xl bg-white/80" aria-hidden="true" />
          ))}
        </div>
        <p className="sr-only" role="status">
          Loading profile
        </p>
      </div>
    </div>
  );
}

function ProfileUnavailable({ username }: { username: string }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#f7f5ff]">
      <SiteHeader />
      <main id="main" className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="w-full max-w-lg rounded-3xl border border-line bg-white p-8 text-center shadow-card sm:p-10">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-800">
            <Link2Off aria-hidden="true" className="size-6" />
          </span>
          <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-zinc-950">
            This page isn&apos;t available
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-700">
            <span className="font-semibold">/{username}</span> may be unpublished, renamed, or never
            claimed. Check the link and try again.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href="/signup">
                Create your page <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/">Go home</Link>
            </Button>
          </div>
          <p className="mt-5 text-xs text-zinc-500">
            Are you the owner?{" "}
            <Link href="/login" className="font-semibold text-violet-800 underline">
              Sign in
            </Link>{" "}
            to publish your profile.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

export function PublicProfile({ username }: { username: string }) {
  const { state, hydrated } = useMockData();

  if (!hydrated) return <ProfileSkeleton />;

  const normalized = username.toLowerCase();
  const available =
    normalized === state.profile.username.toLowerCase() && state.profile.isPublished;

  if (!available) return <ProfileUnavailable username={username} />;

  return (
    <ProfileView
      profile={state.profile}
      categories={state.categories}
      links={state.links}
      appearance={state.appearance}
      variant="page"
    />
  );
}
