"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { AppearanceSettings, Category, Link as LinkRecord, Profile } from "@linkhub/shared";
import { useMockState } from "@/lib/store";
import { PhoneFrame } from "./phone-frame";
import { ProfileView } from "./profile-view";
import { Card } from "./ui/card";

const TIPS = [
  "Drag the handle to reorder links",
  "Use categories to group your profile",
  "Toggle a link to show or hide it",
  "Links in a hidden category stay off your profile",
  "Check Analytics to see what performs best",
];

export function DashboardPreview({
  title = "Public profile preview",
  tips = false,
  appearanceOverride,
  profileOverride,
  categoriesOverride,
  linksOverride,
}: {
  title?: string;
  tips?: boolean;
  appearanceOverride?: AppearanceSettings;
  profileOverride?: Profile;
  categoriesOverride?: Category[];
  linksOverride?: LinkRecord[];
}) {
  const state = useMockState();
  const profile = profileOverride ?? state.profile;
  const appearance = appearanceOverride ?? state.appearance;
  const categories = categoriesOverride ?? state.categories;
  const links = linksOverride ?? state.links;

  return (
    <Card className="sticky top-20 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-zinc-900">{title}</h2>
        <Link
          href={`/${profile.username}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex size-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 transition hover:bg-violet-50 hover:text-violet-900 focus-visible:ring-4 focus-visible:ring-violet-200"
          aria-label="Open public profile in a new tab"
        >
          <ExternalLink className="size-4" />
        </Link>
      </div>
      <PhoneFrame>
        <ProfileView
          profile={profile}
          categories={categories}
          links={links}
          appearance={appearance}
          variant="phone"
          showUnpublishedNote
        />
      </PhoneFrame>
      {tips ? (
        <div className="mt-4 rounded-xl bg-violet-50 p-4">
          <h3 className="mb-2 text-sm font-bold">Quick tips</h3>
          <ul className="space-y-1.5 text-xs text-zinc-700">
            {TIPS.map((tip) => (
              <li key={tip} className="flex gap-2">
                <span aria-hidden="true" className="text-violet-700">
                  ✓
                </span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
