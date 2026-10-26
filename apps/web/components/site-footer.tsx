import Link from "next/link";
import { Logo } from "./logo";

const signupEnabled = process.env.NEXT_PUBLIC_ALLOW_SIGNUP === "true";

function columnsFor(
  allowSignup: boolean,
  showMarketing: boolean,
  profileUsername: string | undefined,
) {
  return [
    {
      title: "Product",
      links: showMarketing
        ? [
            { href: "/#features", label: "Features" },
            { href: "/#how-it-works", label: "How it works" },
            {
              href: profileUsername ? `/${profileUsername}` : "/",
              label: "See a live profile",
            },
          ]
        : [{ href: "/", label: "Home" }],
    },
    {
      title: "Legal",
      links: [
        { href: "/terms", label: "Terms" },
        { href: "/privacy", label: "Privacy" },
        { href: "/contact", label: "Contact" },
      ],
    },
    {
      title: "Account",
      links: [
        { href: "/login", label: "Sign in" },
        ...(allowSignup
          ? [{ href: "/signup", label: "Create your page" }]
          : []),
        { href: "/forgot-password", label: "Reset password" },
      ],
    },
  ];
}

interface SiteFooterProps {
  /** Link to the landing-page sections instead of the profile home link. */
  showMarketing?: boolean;
  /** Public profile used by the marketing footer link. */
  profileUsername?: string;
}

export function SiteFooter({
  showMarketing = false,
  profileUsername,
}: SiteFooterProps = {}) {
  const columns = columnsFor(signupEnabled, showMarketing, profileUsername);

  return (
    <footer className="border-t border-violet-100 bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-zinc-600">
            All your links in one beautiful page, with privacy-friendly analytics built in.
          </p>
        </div>
        {columns.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <h2 className="text-sm font-bold text-zinc-900">{column.title}</h2>
            <ul className="mt-3 space-y-2 text-sm text-zinc-600">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="rounded transition hover:text-violet-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-violet-50">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-zinc-500 sm:px-6">
          <p>© {new Date().getUTCFullYear()} Link Hub. All rights reserved.</p>
          <p>Analytics days are UTC. No IP addresses stored.</p>
        </div>
      </div>
    </footer>
  );
}
