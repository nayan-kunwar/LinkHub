import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import type { ContactTopic } from "@linkhub/shared";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Report a Link Hub profile, ask a privacy question, or get help with your account.",
  robots: { index: false, follow: true },
};

const TOPICS: ContactTopic[] = ["abuse", "privacy", "support", "other"];

interface ContactPageProps {
  searchParams: Promise<{ topic?: string; username?: string }>;
}

export default async function ContactPage({ searchParams }: ContactPageProps) {
  const params = await searchParams;
  const topic = TOPICS.includes(params.topic as ContactTopic)
    ? (params.topic as ContactTopic)
    : "support";
  const username = typeof params.username === "string" ? params.username.slice(0, 30) : "";

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader />
      <main id="main" className="flex-1 bg-[#f7f5ff] py-12 sm:py-16">
        <div className="mx-auto max-w-xl px-4 sm:px-6">
          <div className="rounded-3xl border border-line bg-white p-6 shadow-card sm:p-10">
            <p className="text-xs font-bold uppercase tracking-wider text-violet-700">
              Contact
            </p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-zinc-950 sm:text-4xl">
              {topic === "abuse" && username ? "Report a profile" : "Get in touch"}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">
              {topic === "abuse" && username
                ? "Tell us what is wrong with this page. Reports go directly to the owner inbox."
                : "Send a message to the owner inbox. We usually reply within a few days."}
            </p>
            <ContactForm defaultTopic={topic} username={username} />
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
