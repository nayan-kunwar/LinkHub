"use client";

import Link from "next/link";
import { ArrowRight, Link2Off } from "lucide-react";
import type {
  Category,
  CategoryIconId,
  Link as LinkRecord,
  LinkIconId,
  Profile,
} from "@linkhub/shared";
import { ProfileView } from "@/components/profile-view";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import type { PublicProfileData } from "@/lib/public-profile";

const signupEnabled = process.env.NEXT_PUBLIC_ALLOW_SIGNUP === "true";

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
              <Link href={signupEnabled ? "/signup" : "/login"}>
                {signupEnabled ? "Create your page" : "Sign in"}{" "}
                <ArrowRight aria-hidden="true" className="size-4" />
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

function beaconClick(linkId: string) {
  const body: { linkId: string; referrer?: string } = { linkId };
  if (document.referrer) body.referrer = document.referrer.slice(0, 2048);

  void fetch("/api/v1/analytics/clicks", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify(body),
    credentials: "same-origin",
    keepalive: true,
  }).catch(() => undefined);
}

export function PublicProfile({
  username,
  data,
}: {
  username: string;
  data: PublicProfileData | null;
}) {
  if (!data) return <ProfileUnavailable username={username} />;

  const profile: Profile = {
    id: `public:${data.profile.username}`,
    username: data.profile.username,
    displayName: data.profile.displayName,
    headline: data.profile.headline,
    bio: data.profile.bio,
    avatarUrl: data.profile.avatarUrl,
    socials: data.profile.socials,
    isPublished: true,
  };

  const categories: Category[] = data.categories.map((category) => ({
    id: category.id,
    name: category.name,
    description: category.description,
    color: category.color,
    icon: category.icon as CategoryIconId,
    isVisible: true,
    sortOrder: category.sortOrder,
  }));

  const links: LinkRecord[] = data.links.map((link) => ({
    id: link.id,
    title: link.title,
    url: link.url,
    type: link.type as LinkRecord["type"],
    config: link.config,
    description: link.description,
    categoryId: link.categoryId,
    icon: link.icon as LinkIconId,
    isActive: true,
    sortOrder: link.sortOrder,
    createdAt: "",
  }));

  return (
    <ProfileView
      profile={profile}
      categories={categories}
      links={links}
      appearance={data.appearance}
      variant="page"
      onLinkClick={(link) => beaconClick(link.id)}
    />
  );
}
