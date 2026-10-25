import type { ReactNode } from "react";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

export function LegalPage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <main id="main" className="bg-[#f7f5ff] py-12 sm:py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="rounded-3xl border border-line bg-white p-6 shadow-card sm:p-10">
            <p className="text-xs font-bold uppercase tracking-wider text-violet-700">Legal</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-zinc-950 sm:text-4xl">
              {title}
            </h1>
            <p className="mt-2 text-sm text-zinc-600">{description}</p>
            <p className="mt-1 text-xs text-zinc-500">Last updated: 25 October 2026</p>
            <div className="mt-8 space-y-5 text-sm leading-relaxed text-zinc-700 [&_a]:font-semibold [&_a]:text-violet-800 [&_a]:underline [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-zinc-900 [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_strong]:font-semibold [&_strong]:text-zinc-900 [&_ul]:space-y-1.5">
              {children}
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
