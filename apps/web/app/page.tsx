import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  Download,
  FolderTree,
  Palette,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { PhoneFrame } from "@/components/phone-frame";
import { ProfileView } from "@/components/profile-view";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import {
  DEMO_APPEARANCE,
  DEMO_CATEGORIES,
  DEMO_LINKS,
  DEMO_PROFILE,
} from "@/lib/demo-profile";
import { getPublicProfile } from "@/lib/public-profile";
import { PublicProfile } from "./[username]/public-profile";

const landingMetadata: Metadata = {
  title: "All your links in one place",
  description:
    "Create a beautiful link-in-bio page with categories, themes, privacy-friendly analytics and data export. Free to start.",
};

const signupEnabled = process.env.NEXT_PUBLIC_ALLOW_SIGNUP === "true";

function rootMode(): "profile" | "landing" {
  return process.env.ROOT_MODE === "landing" ? "landing" : "profile";
}

function defaultUsername(): string {
  return (process.env.DEFAULT_USERNAME ?? "nayankunwar").trim().toLowerCase();
}

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  if (rootMode() === "landing") return landingMetadata;

  const username = defaultUsername();
  try {
    const data = await getPublicProfile(username);
    if (!data) return landingMetadata;
    const { profile } = data;
    const description =
      profile.headline || profile.bio || `Links, projects and updates from @${profile.username}.`;
    const title = `${profile.displayName} (@${profile.username})`;
    return {
      title,
      description,
      alternates: { canonical: `/${profile.username}` },
      openGraph: {
        title,
        description,
        type: "profile",
        url: `/${profile.username}`,
      },
      twitter: {
        card: "summary",
        title,
        description,
      },
    };
  } catch {
    return landingMetadata;
  }
}

const FEATURES = [
  {
    icon: Palette,
    title: "Make it unmistakably yours",
    description:
      "Pick a theme, primary color, background and button style. Your changes preview live on a real phone frame.",
  },
  {
    icon: FolderTree,
    title: "Organize with categories",
    description:
      "Group links into categories, add descriptions and colors, then show or hide a group without deleting it.",
  },
  {
    icon: BarChart3,
    title: "Analytics that respect privacy",
    description:
      "See recorded clicks, top links, traffic sources, devices and countries. Known bots and rapid repeat taps are filtered out.",
  },
  {
    icon: Download,
    title: "Your data, exportable",
    description:
      "Download a complete JSON backup or a zip of five CSVs at any time. No lock-in, no support ticket required.",
  },
  {
    icon: ShieldCheck,
    title: "Private by default",
    description:
      "We never store visitor IP addresses. Analytics use short-lived hashes and UTC day boundaries.",
  },
  {
    icon: Zap,
    title: "Fast on every device",
    description:
      "A focused, keyboard-friendly interface for you and a lightweight page your visitors will actually load.",
  },
] as const;

const STEPS = [
  {
    title: "Claim your username",
    description: "Choose a short link like link.nayankunwar.com/yourname. Reserved routes stay reserved.",
  },
  {
    title: "Add and organize links",
    description: "Add links, drag them into order, group them into categories and pick an icon.",
  },
  {
    title: "Share and measure",
    description: "Publish your page, share one link everywhere and watch recorded clicks add up.",
  },
] as const;

const FAQS = [
  {
    question: "Is Link Hub free?",
    answer:
      "Yes. The free plan includes up to 50 links, 20 categories, full appearance controls, analytics and data export. A paid plan is planned but not required today.",
  },
  {
    question: "What analytics do you collect?",
    answer:
      "We record clicks with a short-lived visitor hash, the link, the day in UTC, the referrer domain, device class and country. We never store IP addresses, and raw click events are purged after 90 days.",
  },
  {
    question: "Can I export or delete my data?",
    answer:
      "You can export a JSON backup or a zip of CSVs whenever you like. You can also schedule account deletion; your profile goes offline immediately and you have 30 days to restore it before everything is permanently removed.",
  },
  {
    question: "Can I use my own domain or photo?",
    answer:
      "Custom domains are on the roadmap. For now you can use an https:// avatar URL, or leave it blank and Link Hub will use your initials.",
  },
] as const;

function MarketingPage() {
  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <SiteHeader showMarketingNav />
      <main id="main">
        <section className="relative overflow-hidden bg-[#f7f5ff]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-24 top-10 size-72 rounded-full bg-violet-300/30 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 bottom-0 size-96 rounded-full bg-fuchsia-200/40 blur-3xl"
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white px-3 py-1 text-xs font-bold text-violet-900 shadow-sm">
                <Sparkles aria-hidden="true" className="size-3.5" />
                Your link in bio, without the clutter
              </p>
              <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight text-zinc-950 sm:text-5xl lg:text-6xl">
                All your links,
                <span className="block text-violet-700">one beautiful page.</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-zinc-700">
                Share everything you make from a single link. Organize links into categories,
                customize your page, and see what your audience actually clicks.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Button asChild size="lg">
                  <Link href={signupEnabled ? "/signup" : "/login"}>
                    {signupEnabled ? "Create your free page" : "Sign in to your page"}
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </Link>
                </Button>
                <Button asChild variant="secondary" size="lg">
                  <Link href={`/${defaultUsername()}`}>See a live profile</Link>
                </Button>
              </div>
              <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-700">
                {["Free plan", "50 links", "No credit card"].map((item) => (
                  <li key={item} className="flex items-center gap-1.5">
                    <Check aria-hidden="true" className="size-4 text-violet-700" strokeWidth={3} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative flex justify-center lg:justify-end">
              <div
                aria-hidden="true"
                className="absolute inset-x-8 bottom-4 top-10 rounded-[3rem] bg-gradient-to-br from-violet-300/60 via-fuchsia-200/40 to-white blur-2xl"
              />
              <div className="relative">
                <PhoneFrame className="rotate-1">
                  <ProfileView
                    profile={DEMO_PROFILE}
                    categories={DEMO_CATEGORIES}
                    links={DEMO_LINKS}
                    appearance={DEMO_APPEARANCE}
                    variant="phone"
                  />
                </PhoneFrame>
                <div className="absolute -left-10 top-16 hidden w-36 rounded-2xl border border-violet-100 bg-white p-3 shadow-float sm:block">
                  <p className="text-[11px] font-semibold text-zinc-600">Clicks this week</p>
                  <p className="mt-1 text-xl font-extrabold text-zinc-900">1,284</p>
                  <p className="text-[11px] font-bold text-green-800">↑ 12.6% vs last week</p>
                </div>
                <div className="absolute -right-8 bottom-24 hidden w-40 rounded-2xl border border-violet-100 bg-white p-3 shadow-float sm:block">
                  <p className="text-[11px] font-semibold text-zinc-600">Top link</p>
                  <p className="mt-1 text-sm font-bold text-zinc-900">GitHub</p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-violet-100">
                    <div className="h-full w-[78%] rounded-full bg-violet-700" />
                  </div>
                  <p className="mt-1 text-[11px] text-zinc-600">32% of recorded clicks</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="scroll-mt-20 bg-white py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <p className="text-sm font-bold uppercase tracking-wider text-violet-700">Features</p>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-zinc-950 sm:text-4xl">
                Everything you need. Nothing you don&apos;t.
              </h2>
              <p className="mt-3 text-lg text-zinc-700">
                A focused dashboard for your links, appearance and analytics — with export and
                privacy treated as first-class features.
              </p>
            </div>
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => {
                const Icon = feature.icon;
                return (
                  <li
                    key={feature.title}
                    className="rounded-2xl border border-line bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-float"
                  >
                    <span className="flex size-10 items-center justify-center rounded-xl bg-violet-100 text-violet-800">
                      <Icon aria-hidden="true" className="size-5" strokeWidth={1.9} />
                    </span>
                    <h3 className="mt-4 font-bold text-zinc-900">{feature.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-zinc-700">{feature.description}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-20 bg-[#f7f5ff] py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <p className="text-sm font-bold uppercase tracking-wider text-violet-700">
                How it works
              </p>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-zinc-950 sm:text-4xl">
                From signup to shared in minutes.
              </h2>
            </div>
            <ol className="mt-10 grid gap-4 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step.title} className="relative rounded-2xl border border-violet-100 bg-white p-5 shadow-card">
                  <span className="flex size-9 items-center justify-center rounded-full bg-violet-700 text-sm font-extrabold text-white">
                    {index + 1}
                  </span>
                  <h3 className="mt-4 font-bold text-zinc-900">{step.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-700">{step.description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="faq" className="scroll-mt-20 bg-white py-16 sm:py-20">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-violet-700">FAQ</p>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-zinc-950 sm:text-4xl">
                Questions, answered.
              </h2>
              <p className="mt-3 text-zinc-700">
                Still curious?{" "}
                <a href="mailto:support@linkhub.app" className="font-semibold text-violet-800 underline">
                  Email support
                </a>
                .
              </p>
            </div>
            <div className="divide-y divide-violet-100 rounded-2xl border border-line bg-white shadow-card">
              {FAQS.map((faq) => (
                <details key={faq.question} className="group px-5 py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-zinc-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200">
                    {faq.question}
                    <ChevronDown
                      aria-hidden="true"
                      className="size-4 shrink-0 text-violet-700 transition group-open:rotate-180"
                    />
                  </summary>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-700">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white pb-16 sm:pb-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-800 via-violet-700 to-fuchsia-700 px-6 py-12 text-center text-white shadow-float sm:px-12">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-16 -top-20 size-72 rounded-full bg-white/10 blur-2xl"
              />
              <h2 className="relative text-3xl font-extrabold tracking-tight sm:text-4xl">
                Your next link deserves a better home.
              </h2>
              <p className="relative mx-auto mt-3 max-w-xl text-violet-100">
                Build your page, add your first link and share one URL everywhere.
              </p>
              <div className="relative mt-7 flex flex-wrap justify-center gap-3">
                <Button
                  asChild
                  size="lg"
                  className="bg-white text-violet-900 shadow-sm hover:bg-violet-50"
                >
                  <Link href={signupEnabled ? "/signup" : "/login"}>
                    {signupEnabled ? "Create your page" : "Sign in"}
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  className="border border-white/40 bg-white/10 text-white hover:bg-white/20"
                >
                  <Link href={`/${defaultUsername()}`}>See a live profile</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter showMarketing profileUsername={defaultUsername()} />
    </div>
  );
}

export default async function HomePage() {
  if (rootMode() === "profile") {
    const username = defaultUsername();
    try {
      const data = await getPublicProfile(username);
      if (data) return <PublicProfile username={username} data={data} />;
    } catch {
      // Fall back to the marketing page if the API is unavailable during a
      // build or revalidation; the next ISR pass will try again.
    }
  }
  return <MarketingPage />;
}
