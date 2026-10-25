import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { InfoTip } from "./ui/info-tip";
import { Card } from "./ui/card";
import { cn } from "@/lib/utils";

function Sparkline({ values, className }: { values: number[]; className?: string }) {
  if (values.length < 2) return null;
  const width = 92;
  const height = 26;
  const max = Math.max(1, ...values);
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - 2 - (value / max) * (height - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      aria-hidden="true"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("text-violet-600", className)}
    >
      <polyline fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}

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
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium leading-snug text-zinc-700">
          {label}
          {tip ? <InfoTip label={`About ${label}`}>{tip}</InfoTip> : null}
        </p>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-800">
          <Icon aria-hidden="true" className="size-5" strokeWidth={1.9} />
        </span>
      </div>
      <div className="mt-1 flex items-end justify-between gap-2">
        <p className="text-2xl font-extrabold tracking-tight text-zinc-900">{value}</p>
        {sparkline ? <Sparkline values={sparkline} /> : null}
      </div>
      {sub ? <div className="mt-1 text-xs text-zinc-600">{sub}</div> : null}
    </Card>
  );
}
