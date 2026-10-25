import Link from "next/link";
import { ArrowRight, Compass, LayoutDashboard } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader />
      <main id="main" className="flex flex-1 items-center justify-center bg-[#f7f5ff] px-4 py-16">
        <div className="w-full max-w-lg rounded-3xl border border-line bg-white p-8 text-center shadow-card sm:p-10">
          <p className="text-6xl font-extrabold tracking-tight text-violet-200">404</p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-zinc-950">
            This link leads nowhere
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-700">
            The page may have moved, been unpublished, or never existed. Your own links are safe in
            your dashboard.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href="/">
                <Compass aria-hidden="true" className="size-4" /> Go home
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/dashboard">
                <LayoutDashboard aria-hidden="true" className="size-4" /> Dashboard
              </Link>
            </Button>
          </div>
          <p className="mt-5 text-xs text-zinc-500">
            Looking for a public profile? Use the link the owner shared, for example{" "}
            <Link href="/nayankunwar" className="font-semibold text-violet-800 underline">
              /nayankunwar
            </Link>
            .
          </p>
          <Link
            href="/signup"
            className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-violet-800 underline"
          >
            Create your own page <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
