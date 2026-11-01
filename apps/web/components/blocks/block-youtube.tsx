"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import type { Link, LinkConfigMap } from "@linkhub/shared";
import { cn } from "@/lib/utils";
import type { BlockProps } from "./types";

export function BlockYouTube({
  link,
  config,
  isPage,
  onLinkClick,
}: { link: Link; config: LinkConfigMap["youtube"] } & BlockProps) {
  const [active, setActive] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  const id = config.videoId;

  return (
    <div
      className="lh-card overflow-hidden p-0"
      style={{ borderRadius: "var(--lh-radius-media)" }}
    >
      <div className="relative aspect-video bg-black">
        {active ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
            title={link.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"
            className="absolute inset-0 size-full border-0"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setActive(true);
              onLinkClick?.(link);
            }}
            aria-label={`Play video: ${link.title}`}
            className="group absolute inset-0 focus-visible:ring-4 focus-visible:ring-violet-300"
          >
            {thumbFailed ? (
              <span
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-950"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- YouTube thumbnail
              <img
                src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
                alt=""
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                onError={() => setThumbFailed(true)}
                className="size-full object-cover"
              />
            )}
            <span className="absolute inset-0 grid place-items-center bg-black/20 transition group-hover:bg-black/30">
              <Play
                aria-hidden="true"
                className={cn(
                  "fill-white text-white drop-shadow",
                  isPage ? "size-12" : "size-8",
                )}
              />
            </span>
          </button>
        )}
      </div>
      <p
        className={cn(
          "truncate px-3 py-2 text-center font-semibold",
          isPage ? "text-sm" : "text-xs",
        )}
      >
        {link.title}
      </p>
    </div>
  );
}
