"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertCircle, Check } from "lucide-react";
import { AuthLayout, EnvelopeIllustration } from "@/components/auth/auth-layout";
import { useMockData } from "@/lib/store";
import { startDemoSession } from "@/lib/auth";

type VerifyState = "verifying" | "success" | "expired" | "already";

export function VerifyEmailView() {
  const router = useRouter();
  const { state } = useMockData();
  const [view, setView] = useState<VerifyState>("verifying");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("state");
    if (status === "expired" || status === "invalid") {
      setView("expired");
      return;
    }
    if (status === "already") {
      setView("already");
      return;
    }
    if (status === "success") {
      setView("success");
      return;
    }
    const timer = window.setTimeout(() => setView("success"), 1300);
    return () => window.clearTimeout(timer);
  }, []);

  const goToDashboard = () => {
    startDemoSession(state.account.email, state.profile.displayName);
    router.push("/dashboard");
  };

  return (
    <AuthLayout
      badge="Verify email"
      title="Almost there!"
      description="Verify your email to activate your account and start using Link Hub."
      aside={<EnvelopeIllustration status={view === "expired" ? "expired" : "check"} />}
    >
      <div className="flex flex-col items-center text-center">
        {view === "verifying" ? (
          <>
            <span
              aria-hidden="true"
              className="mt-10 size-12 animate-spin rounded-full border-4 border-violet-100 border-t-violet-700"
            />
            <h1 className="mt-6 text-3xl font-extrabold tracking-tight">Verifying your email</h1>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-zinc-600">
              Hang tight while we confirm your link. This only takes a moment.
            </p>
          </>
        ) : null}

        {view === "success" ? (
          <>
            <span className="flex size-14 items-center justify-center rounded-full bg-green-100 text-green-700">
              <Check aria-hidden="true" className="size-6" strokeWidth={3} />
            </span>
            <h1 className="mt-6 text-3xl font-extrabold tracking-tight">Email verified</h1>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-zinc-600">
              You&apos;re all set. Your Link Hub page is ready to customize.
            </p>
            <button
              type="button"
              onClick={goToDashboard}
              className="mt-6 inline-flex h-10 w-full items-center justify-center rounded-lg bg-violet-700 px-4 text-sm font-semibold text-white transition hover:bg-violet-800 focus-visible:ring-4 focus-visible:ring-violet-200"
            >
              Go to dashboard
            </button>
          </>
        ) : null}

        {view === "expired" ? (
          <>
            <span className="flex size-14 items-center justify-center rounded-full bg-red-100 text-red-700">
              <AlertCircle aria-hidden="true" className="size-6" />
            </span>
            <h1 className="mt-6 text-3xl font-extrabold leading-tight tracking-tight">
              Link expired or invalid
            </h1>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-zinc-600">
              This verification link has expired or was already replaced. We can send you a fresh one.
            </p>
            <Link
              href={`/check-inbox?email=${encodeURIComponent(state.account.email)}`}
              className="mt-6 inline-flex h-10 w-full items-center justify-center rounded-lg bg-violet-700 px-4 text-sm font-semibold text-white transition hover:bg-violet-800 focus-visible:ring-4 focus-visible:ring-violet-200"
            >
              Resend verification email
            </Link>
            <Link href="/login" className="mt-5 text-sm font-semibold text-violet-800 hover:underline">
              ← Back to sign in
            </Link>
          </>
        ) : null}

        {view === "already" ? (
          <>
            <span className="flex size-14 items-center justify-center rounded-full bg-violet-100 text-violet-700">
              <Check aria-hidden="true" className="size-6" strokeWidth={3} />
            </span>
            <h1 className="mt-6 text-3xl font-extrabold tracking-tight">Already verified</h1>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-zinc-600">
              This email address was verified earlier. Sign in to continue.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex h-10 w-full items-center justify-center rounded-lg bg-violet-700 px-4 text-sm font-semibold text-white transition hover:bg-violet-800 focus-visible:ring-4 focus-visible:ring-violet-200"
            >
              Sign in
            </Link>
          </>
        ) : null}
      </div>
    </AuthLayout>
  );
}
