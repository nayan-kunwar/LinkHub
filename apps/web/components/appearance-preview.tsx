"use client";

import Link from "next/link";
import { ExternalLink, Lock } from "lucide-react";
import type {
  AppearanceSettings,
  Category,
  Link as LinkRecord,
  Profile,
} from "@linkhub/shared";
import { SITE_URL } from "@linkhub/shared";
import { cn } from "@/lib/utils";
import { PhoneFrame } from "./phone-frame";
import { ProfileView } from "./profile-view";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

const PROFILE_HOST = SITE_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");

export function AppearancePreview({
  appearance,
  profile,
  categories,
  links,
  dirty,
  className,
}: {
  appearance: AppearanceSettings;
  profile: Profile;
  categories: Category[];
  links: LinkRecord[];
  dirty: boolean;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "sticky top-20 overflow-hidden rounded-[18px] p-3.5 shadow-[0_18px_45px_-30px_rgba(76,29,149,0.45)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-[13px] font-bold tracking-tight text-zinc-900">
            Live preview
          </h2>
          <p className="mt-0.5 flex items-center gap-1 text-[10px] text-zinc-500">
            <Lock aria-hidden="true" className="size-2.5 shrink-0" />
            <span className="truncate">{PROFILE_HOST}</span>
          </p>
        </div>
        <span className="inline-flex h-4 shrink-0 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 text-[8px] font-bold uppercase tracking-wide text-emerald-700">
          <span aria-hidden="true" className="size-1 rounded-full bg-emerald-500" />
          Live
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-1.5">
        <span className="text-[10px] text-zinc-500">Public profile</span>
        <span
          role="status"
          aria-live="polite"
          className={cn(
            "inline-flex h-[18px] items-center gap-1 rounded-full border px-1.5 text-[9px] font-semibold",
            dirty
              ? "border-amber-200 bg-amber-50 text-amber-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700",
          )}
        >
          <span aria-hidden="true" className="size-1 rounded-full bg-current" />
          {dirty ? "Unsaved preview" : "Saved"}
        </span>
      </div>

      <PhoneFrame className="mt-2.5">
        <ProfileView
          profile={profile}
          categories={categories}
          links={links}
          appearance={appearance}
          variant="phone"
          showUnpublishedNote
        />
      </PhoneFrame>

      <Button asChild variant="secondary" className="mt-3 w-full">
        <Link
          href={`/${profile.username}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLink aria-hidden="true" className="size-4" />
          Open profile
        </Link>
      </Button>
    </Card>
  );
}
