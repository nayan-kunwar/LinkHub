"use client";

import * as React from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const PasswordInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => {
  const [visible, setVisible] = React.useState(false);
  return (
    <div className="relative">
      <Lock
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500"
      />
      <Input ref={ref} type={visible ? "text" : "password"} className={cn("pl-9 pr-10", className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute right-1.5 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-zinc-600 transition hover:text-violet-800 focus-visible:ring-4 focus-visible:ring-violet-200"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
});
PasswordInput.displayName = "PasswordInput";

export function AuthAlert({
  children,
  tone = "error",
}: {
  children: React.ReactNode;
  tone?: "error" | "success" | "info";
}) {
  if (!children) return null;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      aria-live="polite"
      className={cn(
        "mb-4 rounded-lg border px-3 py-2.5 text-sm",
        tone === "error" && "border-red-200 bg-red-50 text-red-800",
        tone === "success" && "border-green-200 bg-green-50 text-green-800",
        tone === "info" && "border-violet-200 bg-violet-50 text-violet-900",
      )}
    >
      {children}
    </div>
  );
}

export function SubmitButton({
  loading,
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading || props.disabled}
      className={cn(
        "inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-violet-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-800 focus-visible:ring-4 focus-visible:ring-violet-200 disabled:cursor-not-allowed disabled:bg-zinc-400",
        className,
      )}
      {...props}
    >
      {loading ? (
        <>
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 animate-spin" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".3" strokeWidth="3" />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <span>{children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function PasswordChecklist({
  rules,
}: {
  rules: Array<{ key: string; label: string; met: boolean }>;
}) {
  return (
    <ul className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
      {rules.map((rule) => (
        <li
          key={rule.key}
          className={cn("flex items-center gap-2", rule.met ? "text-green-800" : "text-zinc-600")}
        >
          <span
            aria-hidden="true"
            className={cn(
              "flex size-4 shrink-0 items-center justify-center rounded-full border-2 text-[10px]",
              rule.met ? "border-green-700 bg-green-700 text-white" : "border-zinc-400",
            )}
          >
            {rule.met ? "✓" : ""}
          </span>
          <span>
            {rule.label}
            <span className="sr-only">{rule.met ? " – met" : " – not met"}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
