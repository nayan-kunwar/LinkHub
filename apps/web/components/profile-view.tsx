"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import type { AppearanceSettings, Category, Link as LinkRecord, Profile } from "@linkhub/shared";
import { ExternalLink } from "lucide-react";
import { backgroundFor, themeFor } from "@/lib/appearance";
import { Avatar } from "./avatar";
import { CategoryIcon } from "./category-icon";
import { LinkIcon } from "./link-icon";
import { SocialIcons } from "./social-icons";
import { cn, shadeHex } from "@/lib/utils";

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

function groupLinks(categories: Category[], links: LinkRecord[]) {
  const visible = links.filter((link) => link.isActive);
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const groups = categories
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

  const other = visible.filter((link) => !link.categoryId || !categoryById.get(link.categoryId));
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
  const groups = groupLinks(categories, links);
  const radius = appearance.card === "soft" ? "22px" : appearance.card === "minimal" ? "4px" : "14px";
  const isPage = variant === "page";

  const buttonBackground =
    appearance.button === "outline"
      ? "transparent"
      : appearance.button === "glass"
        ? theme.dark
          ? "rgba(255,255,255,0.12)"
          : "rgba(255,255,255,0.65)"
        : theme.dark
          ? "rgba(255,255,255,0.08)"
          : "#ffffff";
  const buttonBorder =
    appearance.button === "outline"
      ? `1.5px solid ${appearance.color}`
      : appearance.button === "glass"
        ? "1px solid rgba(255,255,255,0.5)"
        : `1px solid ${theme.dark ? "rgba(255,255,255,0.13)" : "#ede9fe"}`;
  const buttonShadow = appearance.button === "solid" ? "0 1px 3px rgba(0,0,0,0.06)" : "none";

  const linkStyle: CSSProperties = {
    background: buttonBackground,
    border: buttonBorder,
    borderRadius: radius,
    boxShadow: buttonShadow,
    color: theme.text,
    backdropFilter: appearance.button === "glass" ? "blur(6px)" : undefined,
    WebkitBackdropFilter: appearance.button === "glass" ? "blur(6px)" : undefined,
  };

  const content = (
    <div
      className={cn(
        "flex flex-col items-center text-center",
        isPage ? "px-1 pt-4 pb-8 sm:pt-8" : "px-4 pb-6 pt-8",
      )}
      style={{ color: theme.text }}
    >
      {appearance.showAvatar ? (
        <Avatar
          name={profile.displayName}
          src={profile.avatarUrl}
          className={isPage ? "size-24 text-3xl" : "size-16 text-2xl"}
          ring={false}
        />
      ) : null}
      <p className={cn("font-bold", isPage ? "mt-4 text-2xl" : "mt-3 text-sm")}>{profile.displayName}</p>
      {profile.headline ? (
        <p
          className={cn("font-medium", isPage ? "mt-1 text-sm" : "text-[11px]")}
          style={{ color: theme.muted }}
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
          style={{ color: theme.muted }}
        >
          {profile.bio}
        </p>
      ) : null}
      {appearance.showSocial ? (
        <SocialIcons
          socials={profile.socials}
          monochrome={theme.dark}
          className={isPage ? "mt-5 gap-4" : "mt-3 gap-3"}
          iconClassName={isPage ? "size-5" : "size-4"}
        />
      ) : null}

      <div className={cn("w-full text-left", isPage ? "mt-7 space-y-5" : "mt-3 space-y-3")}>
        {groups.length === 0 ? (
          <p className={cn("text-center", isPage ? "mt-8 text-sm" : "mt-6 text-xs")} style={{ color: theme.muted }}>
            No visible links yet.
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.id}>
              <p
                className={cn(
                  "mb-1.5 flex items-center gap-1.5 font-bold uppercase tracking-wider",
                  isPage ? "text-[11px]" : "text-[10px]",
                )}
                style={{ color: theme.dark ? theme.muted : shadeHex(group.color, 0.62) }}
              >
                <CategoryIcon icon={group.icon} className={isPage ? "size-3.5" : "size-3"} />
                {group.name}
              </p>
              <ul className={isPage ? "space-y-2.5" : "space-y-1.5"}>
                {group.links.map((link) => (
                  <li key={link.id}>
                    <a
                      href={link.url}
                      target={link.url.startsWith("mailto:") ? undefined : "_blank"}
                      rel={link.url.startsWith("mailto:") ? undefined : "noopener noreferrer"}
                      onClick={() => onLinkClick?.(link)}
                      className={cn(
                        "group/link flex w-full items-center gap-2 font-semibold transition hover:-translate-y-px hover:brightness-[0.99] focus-visible:ring-4 focus-visible:ring-violet-300",
                        isPage ? "px-4 py-3 text-sm" : "px-3 py-2 text-xs",
                      )}
                      style={linkStyle}
                    >
                      <LinkIcon
                        icon={link.icon}
                        url={link.url}
                        monochrome={theme.dark}
                        className={cn(
                          "shrink-0",
                          isPage ? "size-5" : "size-4",
                          theme.dark ? "text-current" : "text-violet-700",
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{link.title}</span>
                        {appearance.showDescription && link.description ? (
                          <span
                            className={cn(
                              "block truncate font-normal",
                              isPage ? "mt-0.5 text-xs" : "text-[10px]",
                            )}
                            style={{ color: theme.muted }}
                          >
                            {link.description}
                          </span>
                        ) : null}
                      </span>
                      <ExternalLink
                        aria-hidden="true"
                        className={cn("shrink-0", isPage ? "size-4" : "size-3")}
                        style={{ color: theme.muted }}
                      />
                    </a>
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
        style={{ color: theme.muted }}
      >
        <Link
          href="/"
          className="rounded transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
        >
          Made with Link Hub
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

  if (!isPage) {
    return (
      <div
        className={cn("min-h-full w-full", className)}
        style={{ background: backgroundFor(appearance, theme) }}
      >
        {content}
      </div>
    );
  }

  return (
    <div
      className={cn("min-h-screen w-full", className)}
      style={{ background: backgroundFor(appearance, theme) }}
    >
      <div className="mx-auto w-full max-w-xl px-5 py-10 sm:px-8 sm:py-16">{content}</div>
    </div>
  );
}
