"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, Mail } from "lucide-react";
import { toast } from "sonner";
import { AuthLayout, EnvelopeIllustration } from "@/components/auth/auth-layout";
import { AuthAlert } from "@/components/auth/auth-form";
import { ApiError, api } from "@/lib/api-client";
import { useAppData } from "@/lib/store";

export function CheckInboxView() {
  const router = useRouter();
  const { state, status } = useAppData();
  const [email, setEmail] = useState(state.account.email);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);

  const signedIn = status === "pending" || status === "authenticated";
  const verified = status === "authenticated";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryEmail = params.get("email");
    if (queryEmail) {
      setEmail(queryEmail);
      setCooldown(60);
    }
  }, []);

  useEffect(() => {
    if (!email && state.account.email) setEmail(state.account.email);
  }, [email, state.account.email]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const resend = async () => {
    if (cooldown > 0 || sending) return;

    if (!signedIn) {
      const next = `/check-inbox${email ? `?email=${encodeURIComponent(email)}` : ""}`;
      const loginQuery = new URLSearchParams({ next });
      if (email) loginQuery.set("email", email);
      router.push(`/login?${loginQuery.toString()}`);
      return;
    }

    setSending(true);
    setError("");
    try {
      await api.auth.resendVerification();
      setCooldown(60);
      toast.success(
        `Verification email sent to ${state.account.email || email || "your address"}`,
      );
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Could not resend the verification email. Try again.",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <AuthLayout
      badge="One more step"
      title={
        <>
          Check your
          <br />
          inbox
        </>
      }
      description={
        <>
          Confirm your email to claim your
          <br />
          link.nayankunwar.com page.
        </>
      }
      aside={<EnvelopeIllustration status={verified ? "check" : "lock"} />}
    >
      {verified ? (
        <div>
          <span className="flex size-12 items-center justify-center rounded-full bg-green-100 text-green-700">
            <Check aria-hidden="true" className="size-5" strokeWidth={3} />
          </span>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight">
            Your email is verified
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600">
            You&apos;re all set. Head to your dashboard to customize your page.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-flex h-10 w-full items-center justify-center rounded-lg bg-violet-700 px-4 text-sm font-semibold text-white transition hover:bg-violet-800 focus-visible:ring-4 focus-visible:ring-violet-200"
          >
            Go to dashboard
          </Link>
        </div>
      ) : (
        <div>
          <span className="flex size-12 items-center justify-center rounded-full bg-violet-100 text-violet-700">
            <Mail aria-hidden="true" className="size-5" />
          </span>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight">Check your inbox</h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600">
            We sent a verification link to{" "}
            <span className="font-semibold text-zinc-800">{email || "your email address"}</span>.
            Click it to activate your account.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600">
            Don&apos;t see it? Check your spam or promotions folder. The link expires in 24 hours.
          </p>

          <AuthAlert>{error}</AuthAlert>

          <button
            type="button"
            onClick={() => {
              void resend();
            }}
            disabled={cooldown > 0 || sending}
            className="mt-6 inline-flex h-10 w-full items-center justify-center rounded-lg bg-zinc-400 px-4 text-sm font-semibold text-white transition hover:bg-zinc-500 disabled:cursor-not-allowed disabled:bg-zinc-400"
          >
            {sending
              ? "Sending…"
              : cooldown > 0
                ? `Resend email in ${cooldown}s`
                : signedIn
                  ? "Resend email"
                  : "Sign in to resend"}
          </button>

          {!signedIn ? (
            <p className="mt-2 text-center text-xs text-zinc-600">
              Resending requires an active session. Sign in with the email above and we&apos;ll
              send a fresh link.
            </p>
          ) : null}

          <p className="mt-5 text-sm text-zinc-700">
            Wrong email?{" "}
            <a
              href="mailto:support@linkhub.app"
              className="font-semibold text-violet-800 hover:underline"
            >
              Contact support
            </a>{" "}
            and we&apos;ll help you fix it.
          </p>
          <p className="mt-6 border-t border-line pt-4 text-center text-xs text-zinc-500">
            Already verified?{" "}
            <Link href="/login" className="font-semibold text-violet-800 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      )}
    </AuthLayout>
  );
}
