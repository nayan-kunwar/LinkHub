import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PhoneFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "mx-auto w-[270px] rounded-[2.6rem] border-[9px] border-zinc-900 bg-zinc-900 shadow-xl shadow-violet-300/40",
        className,
      )}
    >
      <div className="phone-scroll relative h-[560px] overflow-y-auto rounded-[2rem]">{children}</div>
    </div>
  );
}
