import { cn } from "@/lib/utils";

export function DeltaPill({
  change,
  className,
}: {
  change: number | null;
  className?: string;
}) {
  if (change === null) {
    return <span className={cn("text-xs text-zinc-600", className)}>no prior data</span>;
  }
  const positive = change >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
        positive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800",
        className,
      )}
    >
      <span aria-hidden="true">{positive ? "↑" : "↓"}</span> {Math.abs(change)}%
      <span className="sr-only"> versus the previous period</span>
    </span>
  );
}
