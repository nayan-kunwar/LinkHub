"use client";

import { cn, initials } from "@/lib/utils";

interface AvatarProps {
  name: string;
  src?: string;
  className?: string;
  textClassName?: string;
  ring?: boolean;
}

/**
 * URL-only avatars (v2.4): the fallback initials are always rendered when no
 * image is set. The img is decorative because the adjacent name is the label.
 */
export function Avatar({ name, src, className, textClassName, ring = true }: AvatarProps) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-purple-800 font-bold text-white",
        ring && "ring-4 ring-white",
        className,
      )}
      aria-hidden="true"
    >
      <span className={cn("select-none", textClassName)}>{initials(name)}</span>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary remote avatars are user-supplied URLs
        <img
          src={src}
          alt=""
          className="absolute inset-0 size-full object-cover"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      ) : null}
    </span>
  );
}
