import Link from "next/link";
import { Logo } from "./logo";
import { Button } from "./ui/button";

const signupEnabled = process.env.NEXT_PUBLIC_ALLOW_SIGNUP === "true";

interface SiteHeaderProps {
  /** Only the marketing landing page has these in-page sections. */
  showMarketingNav?: boolean;
}

export function SiteHeader({ showMarketingNav = false }: SiteHeaderProps = {}) {
  return (
    <header className="sticky top-0 z-40 border-b border-violet-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Logo />
        {showMarketingNav ? (
          <nav aria-label="Main" className="ml-6 hidden items-center gap-6 text-sm font-semibold text-zinc-700 md:flex">
            <a href="/#features" className="rounded transition hover:text-violet-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200">
              Features
            </a>
            <a href="/#how-it-works" className="rounded transition hover:text-violet-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200">
              How it works
            </a>
            <a href="/#faq" className="rounded transition hover:text-violet-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200">
              FAQ
            </a>
          </nav>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          <Button
            asChild
            variant={signupEnabled ? "ghost" : "primary"}
            size="sm"
            className={signupEnabled ? "hidden sm:inline-flex" : undefined}
          >
            <Link href="/login">Sign in</Link>
          </Button>
          {signupEnabled ? (
            <Button asChild size="sm">
              <Link href="/signup">Create your page</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
