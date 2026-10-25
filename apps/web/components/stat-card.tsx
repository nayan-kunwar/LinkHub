import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { InfoTip } from "./ui/info-tip";
import { Card } from "./ui/card";
import { Sparkline } from "./sparkline";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tip,
  sparkline,
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon: LucideIcon;
  tip?: string;
  sparkline?: number[];
  className?: string;
}) {
  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-start justify-between">
        <p className="flex items-center gap-1 text-sm font-medium leading-snug text-zinc-700">
          {label}
          {tip ? <InfoTip label={`About ${label}`}>{tip}</InfoTip> : null}
        </p>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-800">
          <Icon aria-hidden="true" className="size-5" strokeWidth={1.9} />
        </span>
      </div>
      <p className="mt-1 text-2xl font-extrabold tracking-tight text-zinc-900">{value}</p>
      {sub || sparkline ? (
        <div className="mt-1 flex items-end justify-between gap-2 text-xs text-zinc-600">
          <div className="min-w-0">{sub}</div>
          {sparkline ? <Sparkline values={sparkline} /> : null}
        </div>
      ) : null}
    </Card>
  );
}
