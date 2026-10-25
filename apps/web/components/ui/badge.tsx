import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
  {
    variants: {
      variant: {
        violet: "bg-violet-100 text-violet-800",
        green: "bg-green-100 text-green-800",
        amber: "bg-amber-100 text-amber-900",
        red: "bg-red-100 text-red-800",
        zinc: "bg-zinc-100 text-zinc-700",
        blue: "bg-blue-100 text-blue-800",
        outline: "border border-line-strong bg-white text-violet-800",
        later: "bg-amber-100 text-amber-900 text-[10px] uppercase tracking-wide",
      },
    },
    defaultVariants: { variant: "violet" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
