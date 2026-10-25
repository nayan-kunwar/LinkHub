"use client";

import * as React from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A small, dependency-free info affordance. The tooltip is always rendered in
 * the accessibility tree; it only becomes visible on hover/focus.
 */
export function InfoTip({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  const id = React.useId();
  return (
    <span className={cn("group relative inline-flex items-center", className)}>
      <button
        type="button"
        aria-label={label}
        aria-describedby={id}
        className="rounded-full text-zinc-500 transition hover:text-violet-800 focus-visible:ring-4 focus-visible:ring-violet-200"
      >
        <Info className="size-4" />
      </button>
      <span
        role="tooltip"
        id={id}
        className="pointer-events-none absolute left-1/2 top-6 z-40 w-60 -translate-x-1/2 rounded-lg bg-[#1e1b4b] px-3 py-2 text-left text-xs font-normal leading-relaxed text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {children}
      </span>
    </span>
  );
}

export function Separator({ className }: { className?: string }) {
  return <div role="separator" className={cn("h-px w-full bg-line", className)} />;
}
