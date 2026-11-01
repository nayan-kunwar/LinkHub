import { ExternalLink } from "lucide-react";
import {
  detectProvider,
  isMailtoUrl,
  type Link,
  type LinkConfigMap,
} from "@linkhub/shared";
import { LinkIcon } from "../link-icon";
import { PreviewImage } from "../preview-image";
import { cn } from "@/lib/utils";
import type { BlockProps } from "./types";

export function BlockLink({
  link,
  config,
  isPage,
  dark,
  brand,
  showDescription,
  onLinkClick,
}: { link: Link; config: LinkConfigMap["link"] } & BlockProps) {
  const isMail = isMailtoUrl(link.url);
  const provider = detectProvider(link.url);
  const subtitle = config.subtitle || (config.layout === "classic" ? "" : provider?.label || "");
  const image = config.imageUrl || link.previewImageUrl || "";
  const iconColor = brand || dark ? "text-current" : "text-[color:var(--lh-accent)]";
  const description =
    showDescription && link.description ? link.description : "";

  const anchorProps = {
    href: link.url,
    target: isMail ? undefined : "_blank",
    rel: isMail ? undefined : "noopener noreferrer",
    onClick: () => onLinkClick?.(link),
  };

  if (config.layout === "featured") {
    return (
      <a
        {...anchorProps}
        className="lh-card group/link block w-full overflow-hidden text-center transition hover:-translate-y-0.5 hover:brightness-[1.02] focus-visible:ring-4 focus-visible:ring-violet-300"
        style={{ borderRadius: "var(--lh-radius-media)" }}
      >
        <PreviewImage
          src={image}
          alt=""
          className="block aspect-[16/9] w-full object-cover"
          fallback={
            <span
              aria-hidden="true"
              className="flex aspect-[16/9] w-full items-center justify-center bg-black/5"
            >
              <LinkIcon
                icon={link.icon}
                url={link.url}
                monochrome={dark || brand}
                className={cn("size-10 opacity-70", iconColor)}
              />
            </span>
          }
        />
        <span className={cn("block", isPage ? "px-5 py-4" : "px-3 py-2.5")}>
          <span
            className={cn(
              "block truncate font-semibold",
              isPage ? "text-base" : "text-xs",
            )}
          >
            {link.title}
          </span>
          {subtitle ? (
            <span
              className={cn(
                "mt-0.5 block truncate",
                isPage ? "text-xs" : "text-[10px]",
              )}
              style={{ color: "var(--lh-card-muted)" }}
            >
              {subtitle}
            </span>
          ) : null}
          {description ? (
            <span
              className={cn(
                "mt-0.5 block truncate",
                isPage ? "text-xs" : "text-[10px]",
              )}
              style={{ color: "var(--lh-card-muted)" }}
            >
              {description}
            </span>
          ) : null}
        </span>
      </a>
    );
  }

  if (config.layout === "rich") {
    return (
      <a
        {...anchorProps}
        className={cn(
          "lh-card group/link grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center font-semibold transition hover:-translate-y-0.5 hover:brightness-[1.02] focus-visible:ring-4 focus-visible:ring-violet-300",
          isPage ? "gap-3 px-4 py-3 text-sm" : "gap-2 px-3 py-2 text-xs",
        )}
      >
        <span
          className={cn(
            "lh-media flex shrink-0 items-center justify-center overflow-hidden",
            isPage ? "size-14" : "size-10",
          )}
          style={{
            background: brand
              ? "rgba(255,255,255,0.18)"
              : "color-mix(in srgb, var(--lh-accent) 10%, transparent)",
          }}
        >
          <PreviewImage
            src={image}
            alt=""
            className="size-full object-cover"
            fallback={
              <LinkIcon
                icon={link.icon}
                url={link.url}
                monochrome={dark || brand}
                className={cn(isPage ? "size-6" : "size-5", iconColor)}
              />
            }
          />
        </span>

        <span className="min-w-0 text-center">
          <span className="block truncate">{link.title}</span>
          {subtitle ? (
            <span
              className={cn(
                "block truncate font-normal",
                isPage ? "mt-0.5 text-xs" : "text-[10px]",
              )}
              style={{ color: "var(--lh-card-muted)" }}
            >
              {subtitle}
            </span>
          ) : null}
          {description ? (
            <span
              className={cn(
                "block truncate font-normal",
                isPage ? "mt-0.5 text-xs" : "text-[10px]",
              )}
              style={{ color: "var(--lh-card-muted)" }}
            >
              {description}
            </span>
          ) : null}
        </span>

        <ExternalLink
          aria-hidden="true"
          className={cn("shrink-0", isPage ? "size-4" : "size-3")}
          style={{ color: "var(--lh-card-muted)" }}
        />
      </a>
    );
  }

  return (
    <a
      {...anchorProps}
      className={cn(
        "lh-card group/link flex w-full items-center font-semibold transition hover:-translate-y-0.5 hover:brightness-[1.02] focus-visible:ring-4 focus-visible:ring-violet-300",
        isPage ? "gap-2 px-4 py-3 text-sm" : "gap-2 px-3 py-2 text-xs",
      )}
    >
      <LinkIcon
        icon={link.icon}
        url={link.url}
        monochrome={dark || brand}
        className={cn(
          "shrink-0",
          isPage ? "size-5" : "size-4",
          iconColor,
        )}
      />
      <span className="min-w-0 flex-1 text-center">
        <span className="block truncate">{link.title}</span>
        {config.subtitle ? (
          <span
            className={cn(
              "block truncate font-normal",
              isPage ? "mt-0.5 text-xs" : "text-[10px]",
            )}
            style={{ color: "var(--lh-card-muted)" }}
          >
            {config.subtitle}
          </span>
        ) : null}
        {description ? (
          <span
            className={cn(
              "block truncate font-normal",
              isPage ? "mt-0.5 text-xs" : "text-[10px]",
            )}
            style={{ color: "var(--lh-card-muted)" }}
          >
            {description}
          </span>
        ) : null}
      </span>
      <ExternalLink
        aria-hidden="true"
        className={cn("shrink-0", isPage ? "size-4" : "size-3")}
        style={{ color: "var(--lh-card-muted)" }}
      />
    </a>
  );
}
