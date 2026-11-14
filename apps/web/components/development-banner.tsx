import { Construction } from "lucide-react";

/**
 * Site-wide notice for the home page while Link Hub is still being built.
 * Kept in normal document flow so it never overlaps the sticky header or the
 * public profile background. Disable it at launch with
 * NEXT_PUBLIC_DEVELOPMENT_BANNER=false.
 */
export function DevelopmentBanner() {
  return (
    <aside
      aria-label="Development notice"
      data-testid="development-banner"
      className="relative isolate overflow-hidden bg-gradient-to-r from-violet-950 via-violet-900 to-fuchsia-900 text-white"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 py-2 text-center text-[11px] leading-snug sm:px-6 sm:text-xs">
        <Construction
          aria-hidden="true"
          className="size-3.5 shrink-0 text-violet-200"
          strokeWidth={2}
        />
        <p>
          <strong className="font-semibold">Link Hub is in development.</strong>{" "}
          <span className="text-violet-200">
            Some features may change or be unavailable.
          </span>
        </p>
      </div>
    </aside>
  );
}
