import Link from "next/link";
import type { ReactNode } from "react";
import { Globe2, ExternalLink, Check } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { BrandIcon } from "@/components/brand-icons";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

export function Waves() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute bottom-0 left-0 h-72 w-full"
      viewBox="0 0 600 260"
      preserveAspectRatio="none"
    >
      <path d="M0 140 C120 90 240 150 360 110 S540 40 600 70 V260 H0Z" fill="#e4dcfb" />
      <path d="M0 190 C150 150 280 210 420 170 S560 140 600 160 V260 H0Z" fill="#cfc2f5" />
      <path d="M0 225 C160 200 320 240 470 215 S570 205 600 215 V260 H0Z" fill="#b6a6ee" />
    </svg>
  );
}

function TreeCluster({ className, color }: { className?: string; color: string }) {
  return (
    <svg
      aria-hidden="true"
      className={cn("pointer-events-none absolute bottom-6 h-48 w-28", className)}
      viewBox="0 0 160 210"
      fill={color}
    >
      <path d="M38 20 66 72H58l17 38H65l19 38H10l19-38H19l17-38h-8z" />
      <rect x="36" y="148" width="4" height="14" />
      <path d="M88 62 110 104h-6l13 28h-7l14 30H73l14-30h-7l13-28h-6z" opacity=".72" />
      <rect x="86" y="162" width="4" height="12" />
      <path d="M126 96 142 126h-4l9 20h-5l10 20h-36l10-20h-5l9-20h-4z" opacity=".5" />
      <rect x="124" y="166" width="4" height="10" />
    </svg>
  );
}

export function AuthTrees() {
  return (
    <>
      <TreeCluster className="left-0" color="#6d5bb0" />
      <TreeCluster className="-right-2 scale-x-[-1]" color="#4c3d8f" />
    </>
  );
}

export function AuthLayout({
  badge,
  title,
  description,
  aside,
  children,
  panelClassName,
}: {
  badge: string;
  title: ReactNode;
  description: ReactNode;
  aside: ReactNode;
  children: ReactNode;
  panelClassName?: string;
}) {
  return (
    <div className="auth-gradient min-h-screen text-zinc-900">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-violet-800 focus:shadow-lg"
      >
        Skip to content
      </a>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 pb-3 pt-5">
        <Logo className="text-lg" iconClassName="size-6" />
        <nav aria-label="Main">
          <ul className="flex gap-5 text-sm font-medium text-zinc-700">
            <li>
              <Link href="/" className="transition hover:text-violet-800">
                Home
              </Link>
            </li>
            <li>
              <Link href="/#features" className="transition hover:text-violet-800">
                Features
              </Link>
            </li>
            <li>
              <Link href="/#contact" className="transition hover:text-violet-800">
                Contact
              </Link>
            </li>
          </ul>
        </nav>
      </header>

      <main id="main" className="mx-auto max-w-6xl px-5 pb-8">
        <div className="grid min-h-[620px] overflow-hidden rounded-3xl bg-white/40 shadow-xl shadow-violet-200/60 md:grid-cols-[minmax(0,440px)_1fr]">
          <section className={cn("flex flex-col justify-center bg-white p-7 sm:p-10", panelClassName)}>
            {children}
          </section>

          <aside className="relative hidden overflow-hidden bg-gradient-to-b from-violet-50 via-violet-100 to-violet-200 p-10 pb-8 md:block">
            <Waves />
            <AuthTrees />
            <div className="relative z-10 flex h-full flex-col">
              <span className="inline-flex w-fit rounded-full bg-violet-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-violet-900">
                {badge}
              </span>
              <h2 className="mt-4 max-w-md text-[2.6rem] font-extrabold leading-[1.1] tracking-tight text-[#1e1b4b]">
                {title}
              </h2>
              <p className="mt-3 max-w-sm text-[1.05rem] leading-relaxed text-zinc-600">{description}</p>
              <div className="relative mt-5 flex-1">{aside}</div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

const PREVIEW_ROWS = [
  { title: "My Portfolio", type: "globe" as const },
  { title: "Follow on GitHub", type: "github" as const },
  { title: "Connect on LinkedIn", type: "linkedin" as const },
  { title: "Read on Medium", type: "medium" as const },
];

export function AuthPreviewCard() {
  return (
    <div className="relative mx-auto w-72">
      <svg
        aria-hidden="true"
        className="absolute -left-20 top-6 h-24 w-16 text-violet-500"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        viewBox="0 0 60 90"
      >
        <path d="M30 5 C5 25 5 60 45 75" />
        <path d="M33 64 L45 75 L30 80" />
      </svg>
      <div className="rounded-3xl bg-white/95 p-5 shadow-2xl shadow-violet-300/60">
        <div className="flex flex-col items-center text-center">
          <Avatar name="Nayan Kunwar" className="size-16 text-2xl" ring={false} />
          <p className="mt-3 font-bold text-[#1e1b4b]">Nayan Kunwar</p>
          <p className="text-xs text-zinc-600">Backend Engineer</p>
          <div className="mt-3 flex items-center gap-3">
            <BrandIcon name="github" className="size-4" />
            <BrandIcon name="linkedin" className="size-4" />
            <BrandIcon name="x" className="size-4" />
            <BrandIcon name="medium" className="size-4" />
          </div>
          <ul className="mt-4 w-full space-y-2">
            {PREVIEW_ROWS.map((row) => (
              <li
                key={row.title}
                className="flex items-center gap-3 rounded-xl bg-violet-50 px-3 py-2 text-left text-sm font-semibold text-zinc-800 shadow-sm"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-violet-200 text-violet-800">
                  {row.type === "globe" ? (
                    <Globe2 className="size-4" strokeWidth={2} />
                  ) : (
                    <BrandIcon name={row.type} className="size-3.5" />
                  )}
                </span>
                <span className="flex-1">{row.title}</span>
                <ExternalLink className="size-3.5 shrink-0 text-zinc-600" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function AuthBenefits() {
  const benefits = [
    "Beautiful and customizable profiles",
    "Built-in analytics",
    "Organize with categories",
    "Privacy-friendly analytics",
    "Free to get started",
  ];
  return (
    <ul className="mt-8 space-y-4">
      {benefits.map((benefit) => (
        <li key={benefit} className="flex items-center gap-3 text-sm text-zinc-700">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-violet-200/80 text-violet-800">
            <Check className="size-4" strokeWidth={2.6} />
          </span>
          {benefit}
        </li>
      ))}
    </ul>
  );
}

export function EnvelopeIllustration({ status }: { status?: "lock" | "check" | "expired" }) {
  return (
    <div className="relative mx-auto mt-8 flex h-56 w-full items-center justify-center">
      <span className="absolute left-[18%] top-10 size-2 rounded-full bg-violet-300" />
      <span className="absolute right-[18%] top-16 size-2 rounded-full bg-violet-300" />
      <svg aria-hidden="true" viewBox="0 0 180 140" className="relative h-48 w-60 drop-shadow-sm">
        <rect x="24" y="44" width="132" height="76" rx="12" fill="#a78bfa" />
        <path d="M24 56 90 100 156 56v52a12 12 0 0 1-12 12H36a12 12 0 0 1-12-12z" fill="#8b5cf6" />
        <path d="M24 56 90 100l66-44" fill="none" stroke="#c4b5fd" strokeWidth="2" />
        <rect x="52" y="20" width="76" height="58" rx="8" fill="#fff" />
        <rect x="64" y="34" width="42" height="5" rx="2.5" fill="#c4b5fd" />
        <rect x="64" y="45" width="52" height="5" rx="2.5" fill="#ddd6fe" />
        <rect x="64" y="56" width="32" height="5" rx="2.5" fill="#ede9fe" />
        {status === "lock" ? (
          <g transform="translate(118 78)">
            <rect width="40" height="40" rx="8" fill="#6d28d9" />
            <rect x="10" y="18" width="20" height="14" rx="3" fill="#fff" />
            <path d="M14 18v-5a6 6 0 0 1 12 0v5" fill="none" stroke="#fff" strokeWidth="3" />
          </g>
        ) : null}
        {status === "check" ? (
          <g transform="translate(118 22)">
            <circle cx="20" cy="20" r="20" fill="#16a34a" />
            <path d="m11 20 6 6 12-13" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        ) : null}
        {status === "expired" ? (
          <g transform="translate(118 22)">
            <circle cx="20" cy="20" r="20" fill="#d97706" />
            <path d="M20 10v12M20 29h.01" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
          </g>
        ) : null}
      </svg>
    </div>
  );
}

export function LockIllustration() {
  return (
    <div className="relative mx-auto mt-8 flex h-56 items-center justify-center">
      <svg aria-hidden="true" viewBox="0 0 200 160" className="h-52 w-64">
        <g transform="translate(30 26)">
          <rect width="84" height="72" rx="14" fill="#6d28d9" />
          <path d="M20 72V38a22 22 0 0 1 44 0v34" fill="none" stroke="#6d28d9" strokeWidth="13" />
          <circle cx="42" cy="38" r="6" fill="#fff" />
        </g>
        <g transform="translate(112 62)" opacity=".55">
          <rect width="62" height="54" rx="11" fill="#c4b5fd" />
          <path d="M15 54V29a16 16 0 0 1 32 0v25" fill="none" stroke="#c4b5fd" strokeWidth="10" />
          <circle cx="31" cy="29" r="4.5" fill="#fff" />
        </g>
      </svg>
    </div>
  );
}
