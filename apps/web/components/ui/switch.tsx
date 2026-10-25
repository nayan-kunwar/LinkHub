"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ComponentRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "relative inline-flex h-[1.45rem] w-[2.6rem] shrink-0 cursor-pointer items-center rounded-full bg-zinc-400 outline-none transition-colors focus-visible:ring-4 focus-visible:ring-violet-200 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-violet-700",
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb className="pointer-events-none block size-[1.05rem] translate-x-1 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-[1.35rem]" />
  </SwitchPrimitive.Root>
));
Switch.displayName = "Switch";

export { Switch };
