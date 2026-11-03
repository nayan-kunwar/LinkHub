"use client";

import Link from "next/link";
import type {
  AppearanceSettings,
  Category,
  CategoryIconId,
  Link as LinkRecord,
  Profile,
} from "@linkhub/shared";
import { SITE_URL } from "@linkhub/shared";
import { themeFor, themeVars, backgroundIsDark } from "@/lib/appearance";
import { Avatar } from "./avatar";
import { BlockRenderer } from "./blocks";
import { ShareButton } from "./share-button";
import { SocialIcons } from "./social-icons";
import { cn } from "@/lib/utils";

interface ProfileViewProps {
  profile: Profile;
  categories: Category[];
  links: LinkRecord[];
  appearance: AppearanceSettings;
  variant?: "phone" | "page";
  showUnpublishedNote?: boolean;
  className?: string;
  onLinkClick?: (link: LinkRecord) => void;
}

interface LinkGroup {
  id: string;
  name: string;
  color: string;
  icon: CategoryIconId;
  links: LinkRecord[];
}

function groupLinks(
  categories: Category[],
  links: LinkRecord[],
  layout: AppearanceSettings["layout"],
): LinkGroup[] {
  const visible = links
    .filter((link) => link.isActive)
    .sort((left, right) => left.sortOrder - right.sortOrder);

  if (layout === "flat") {
    return visible.length > 0
      ? [
          {
            id: "all",
            name: "",
            color: "#71717a",
            icon: "link",
            links: visible,
          },
        ]
      : [];
  }

  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const groups: LinkGroup[] = categories
    .filter((category) => category.isVisible)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((category) => ({
      id: category.id,
      name: category.name,
      color: category.color,
      icon: category.icon,
      links: visible.filter((link) => link.categoryId === category.id),
    }))
    .filter((group) => group.links.length > 0);

  const other = visible.filter(
    (link) => !link.categoryId || !categoryById.get(link.categoryId),
  );
  if (other.length > 0) {
    groups.push({
      id: "other",
      name: "Other links",
      color: "#71717a",
      icon: "link",
      links: other,
    });
  }
  return groups;
}

export function ProfileView({
  profile,
  categories,
  links,
  appearance,
  variant = "phone",
  showUnpublishedNote = false,
  className,
  onLinkClick,
}: ProfileViewProps) {
  const theme = themeFor(appearance);
  const darkSurface = theme.dark || backgroundIsDark(appearance, theme);
  const groups = groupLinks(categories, links, appearance.layout);
  const isPage = variant === "page";
  const brand = appearance.button === "brand";
  const shareUrl = profile.username
    ? `${SITE_URL.replace(/\/$/, "")}/${profile.username}`
    : "";

  const content = (
    <div
      className={cn(
        "flex flex-col items-center text-center",
        isPage ? "px-1 pt-4 pb-8 sm:pt-8" : "px-4 pb-6 pt-8",
      )}
    >
      {appearance.showAvatar ? (
        <Avatar
          name={profile.displayName}
          src={profile.avatarUrl}
          className={isPage ? "size-28 text-4xl" : "size-16 text-2xl"}
          ring={false}
        />
      ) : null}
      <p
        className={cn(
          "font-bold tracking-tight",
          isPage ? "mt-4 text-2xl" : "mt-3 text-sm",
        )}
      >
        {profile.displayName}
      </p>
      {profile.headline ? (
        <p
          className={cn("font-medium", isPage ? "mt-1 text-sm" : "text-[11px]")}
          style={{ color: "var(--lh-muted)" }}
        >
          {profile.headline}
        </p>
      ) : null}
      {appearance.showBio && profile.bio ? (
        <p
          className={cn(
            "leading-snug",
            isPage ? "mt-3 max-w-md text-sm" : "mt-1.5 max-w-[220px] text-[11px]",
          )}
          style={{ color: "var(--lh-muted)" }}
        >
          {profile.bio}
        </p>
      ) : null}
      {appearance.showSocial ? (
        <SocialIcons
          socials={profile.socials}
          monochrome={darkSurface}
          className={isPage ? "mt-5 gap-4" : "mt-3 gap-3"}
          iconClassName={isPage ? "size-5" : "size-4"}
        />
      ) : null}
      {shareUrl ? (
        <div className={isPage ? "mt-5" : "mt-3"}>
          <ShareButton
            url={shareUrl}
            title={`${profile.displayName} (@${profile.username})`}
            isPage={isPage}
          />
        </div>
      ) : null}

      <div
        className={cn(
          "w-full text-left",
          isPage ? "mt-8 space-y-6" : "mt-4 space-y-4",
        )}
      >
        {groups.length === 0 ? (
          <p
            className={cn("text-center", isPage ? "mt-8 text-sm" : "mt-6 text-xs")}
            style={{ color: "var(--lh-muted)" }}
          >
            No visible links yet.
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.id}>
              {group.name ? (
                <p
                  className={cn(
                    "flex items-center justify-center gap-1.5 text-center font-bold tracking-tight",
                    isPage ? "mb-2.5 text-sm" : "mb-1.5 text-[11px]",
                  )}
                  style={{ color: "var(--lh-text)" }}
                >
                  <span
                    aria-hidden="true"
                    className="inline-block size-1.5 rounded-full"
                    style={{ backgroundColor: group.color }}
                  />
                  {group.name}
                </p>
              ) : null}
              <ul className={isPage ? "space-y-2.5" : "space-y-1.5"}>
                {group.links.map((link) => (
                  <li key={link.id} data-link-id={link.id}>
                    <BlockRenderer
                      link={link}
                      isPage={isPage}
                      dark={darkSurface}
                      brand={brand}
                      showDescription={appearance.showDescription}
                      onLinkClick={onLinkClick}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>

      {showUnpublishedNote && !profile.isPublished ? (
        <p
          className={cn(
            "w-full rounded-md bg-amber-100 py-1 font-semibold text-amber-900",
            isPage ? "mt-6 text-sm" : "mt-4 text-[11px]",
          )}
        >
          Profile is unpublished
        </p>
      ) : null}

      <div
        className={cn(
          "flex flex-wrap items-center justify-center gap-x-2 gap-y-1",
          isPage ? "mt-10 text-xs" : "mt-5 text-[10px]",
        )}
        style={{ color: "var(--lh-muted)" }}
      >
        <Link
          href="/"
          className="rounded font-semibold transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
        >
          Create your own Link Hub
        </Link>
        {isPage ? (
          <>
            <span aria-hidden="true">·</span>
            <Link
              href={`/contact?topic=abuse&username=${encodeURIComponent(profile.username)}`}
              className="rounded transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
            >
              Report this page
            </Link>
          </>
        ) : null}
      </div>
    </div>
  );

  const wrapperStyle = {
    ...themeVars(appearance, theme),
    background: "var(--lh-bg)",
    color: "var(--lh-text)",
    fontFamily: "var(--lh-font)",
  };

  if (!isPage) {
    return (
      <div
        className={cn("min-h-full w-full", className)}
        style={wrapperStyle}
      >
        {content}
      </div>
    );
  }

  return (
    <div
      className={cn("min-h-screen w-full", className)}
      style={wrapperStyle}
    >
      <div className="mx-auto w-full max-w-xl px-5 py-10 sm:px-8 sm:py-16">{content}</div>
    </div>
  );
}
