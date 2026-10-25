import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-5 flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900">{title}</h1>
        {description ? <p className="mt-1 text-sm text-zinc-700">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">{actions}</div> : null}
    </div>
  );
}
