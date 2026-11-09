import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function DashboardFrame({
  children,
  preview,
  className,
  previewClassName = "xl:block",
}: {
  children: ReactNode;
  preview?: ReactNode;
  className?: string;
  previewClassName?: string;
}) {
  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <main id="main" className={cn("min-w-0 flex-1 px-4 py-5 sm:p-6", className)}>
        {children}
      </main>
      {preview ? (
        <aside
          className={cn(
            "hidden w-[340px] shrink-0 p-5 pl-0",
            previewClassName,
          )}
          aria-label="Public profile preview"
        >
          {preview}
        </aside>
      ) : null}
    </div>
  );
}
