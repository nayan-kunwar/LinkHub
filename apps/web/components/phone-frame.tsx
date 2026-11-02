import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PhoneFrame({
  children,
  className,
  screenClassName,
}: {
  children: ReactNode;
  className?: string;
  screenClassName?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-[270px] rounded-[2.6rem] border-[9px] border-zinc-900 bg-zinc-900 shadow-xl shadow-violet-300/40",
        className,
      )}
    >
      <div
        data-phone-scroll=""
        className={cn(
          "phone-scroll relative h-[560px] overflow-y-auto rounded-[2rem]",
          screenClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
