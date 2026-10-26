import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 shadow-[0_1px_1px_rgba(24,24,27,0.02)] outline-none transition placeholder:text-zinc-400 hover:border-zinc-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-100 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-500 aria-[invalid=true]:border-red-600 aria-[invalid=true]:focus:ring-red-100",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "min-h-24 w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 hover:border-zinc-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-100 disabled:cursor-not-allowed disabled:bg-zinc-50 aria-[invalid=true]:border-red-600 aria-[invalid=true]:focus:ring-red-100",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className={cn("relative", className?.includes("w-auto") ? "inline-block" : "w-full")}>
      <select
        ref={ref}
        className={cn(
          "h-10 w-full cursor-pointer appearance-none rounded-lg border border-zinc-300 bg-white py-0 pl-3 pr-9 text-sm text-zinc-900 outline-none transition hover:border-zinc-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-100 disabled:cursor-not-allowed disabled:bg-zinc-50",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  ),
);
Select.displayName = "Select";

const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn("mb-1.5 block text-sm font-semibold text-zinc-800", className)}
      {...props}
    />
  ),
);
Label.displayName = "Label";

function FieldError({
  children,
  className,
  id,
}: {
  children?: React.ReactNode;
  className?: string;
  id?: string;
}) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className={cn("mt-1 text-xs font-medium text-red-700", className)}>
      {children}
    </p>
  );
}

function FieldHint({
  children,
  className,
  id,
}: {
  children?: React.ReactNode;
  className?: string;
  id?: string;
}) {
  if (!children) return null;
  return <p id={id} className={cn("mt-1 text-xs text-zinc-500", className)}>{children}</p>;
}

export { Input, Textarea, Select, Label, FieldError, FieldHint };
