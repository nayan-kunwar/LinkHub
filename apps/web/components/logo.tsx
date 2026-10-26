import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  iconClassName,
  href = "/",
  label = "Link Hub",
}: {
  className?: string;
  iconClassName?: string;
  href?: string | null;
  label?: string;
}) {
  const content = (
    <>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn("size-7 text-violet-700", iconClassName)}
      >
        <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
        <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" />
      </svg>
      <span>{label}</span>
    </>
  );

  const classes = cn(
    "inline-flex items-center gap-2 rounded text-xl font-extrabold text-zinc-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200",
    className,
  );
  if (!href) return <span className={classes}>{content}</span>;
  return (
    <Link href={href} className={classes} aria-label="Link Hub home">
      {content}
    </Link>
  );
}
