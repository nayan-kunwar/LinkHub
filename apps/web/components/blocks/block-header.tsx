import type { Link, LinkConfigMap } from "@linkhub/shared";
import { cn } from "@/lib/utils";
import type { BlockProps } from "./types";

export function BlockHeader({
  link,
  config,
  isPage,
}: { link: Link; config: LinkConfigMap["header"] } & BlockProps) {
  return (
    <div className={cn("text-center", isPage ? "pt-4" : "pt-2")}>
      <h2
        className={cn("font-bold tracking-tight", isPage ? "text-lg" : "text-sm")}
        style={{ color: "var(--lh-text)" }}
      >
        {link.title}
      </h2>
      {config.subtitle ? (
        <p
          className={cn("mt-0.5", isPage ? "text-sm" : "text-[11px]")}
          style={{ color: "var(--lh-muted)" }}
        >
          {config.subtitle}
        </p>
      ) : null}
    </div>
  );
}
