"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertCircle, Check, Clock3, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AuthLayout, EnvelopeIllustration } from "@/components/auth/auth-layout";
import { useMockData } from "@/lib/store";
import { formatDate } from "@/lib/utils";

type RestoreView = "scheduled" | "restored" | "active" | "expired";

function daysLeft(value: string): number {
  const remaining = new Date(value).getTime() - Date.now();
  return Math.max(0, Math.ceil(remaining / 86_400_000));
}

function RestoreSkeleton() {
  return (
    <div className="flex flex-col items-center text-center" aria-busy="true">
      <span className="mt-10 size-12 animate-spin rounded-full border-4 border-violet-100 border-t-violet-700" />
      <p className="mt-5 text-sm text-zinc-600" role="status">
        Checking your account…
      </p>
    </div>
  );
}

export function RestoreAccountView() {
  const { state, hydrated, restoreAccount } = useMockData();
  const [restored, setRestored] = useState(false);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("state") === "expired") setExpired(true);
    if (params.get("state") === "restored") setRestored(true);
  }, []);

  const scheduledFor = state.account.deletionScheduledFor;
  const view: RestoreView | null = !hydrated
    ? null
    : expired
      ? "expired"
      : restored
        ? "restored"
        : scheduledFor
          ? "scheduled"
          : "active";

  const restore = () => {
    restoreAccount();
    setRestored(true);
    toast.success("Account restored. Your data is safe.");
  };

  return (
    <AuthLayout
      badge="Account restore"
      title={
        <>
          Changed your mind?
          <br />
          We kept it safe.
        </>
      }
      description={
        <>
          Your links, categories and analytics stay
          <br />
          recoverable during the 30-day grace period.
        </>
      }
      aside={
        <EnvelopeIllustration
          status={view === "restored" ? "check" : view === "expired" ? "expired" : "lock"}
        />
      }
    >
      <div className="flex flex-col items-center text-center">
        {view === null ? <RestoreSkeleton /> : null}

        {view === "scheduled" && scheduledFor ? (
          <>
            <span className="flex size-14 items-center justify-center rounded-full bg-amber-100 text-amber-800">
              <Clock3 aria-hidden="true" className="size-6" />
            </span>
            <h1 className="mt-6 text-3xl font-extrabold leading-tight tracking-tight">
              Restore your account
            </h1>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-zinc-600">
              Your account is scheduled for deletion on{" "}
              <strong className="text-zinc-900">
                {formatDate(scheduledFor, { month: "long" })}
              </strong>
              . You have <strong className="text-zinc-900">{daysLeft(scheduledFor)} days</strong>{" "}
              left to cancel it.
            </p>

            <div className="mt-6 w-full rounded-2xl border border-violet-200 bg-violet-50 p-4 text-left text-sm text-violet-950">
              <p className="flex items-start gap-2 font-semibold">
                <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                Restoring keeps your links, categories and analytics.
              </p>
              <p className="mt-1.5 pl-6 text-violet-900">
                Your public profile stays unpublished until you choose to publish it again.
              </p>
            </div>

            <button
              type="button"
              onClick={restore}
              className="mt-6 inline-flex h-10 w-full items-center justify-center rounded-lg bg-violet-700 px-4 text-sm font-semibold text-white transition hover:bg-violet-800 focus-visible:ring-4 focus-visible:ring-violet-200"
            >
              Restore my account
            </button>
            <p className="mt-4 text-sm text-zinc-600">
              Prefer to sign in?{" "}
              <Link href="/login" className="font-semibold text-violet-800 hover:underline">
                Signing in also restores it
              </Link>
              .
            </p>
          </>
        ) : null}

        {view === "restored" ? (
          <>
            <span className="flex size-14 items-center justify-center rounded-full bg-green-100 text-green-700">
              <Check aria-hidden="true" className="size-6" strokeWidth={3} />
            </span>
            <h1 className="mt-6 text-3xl font-extrabold leading-tight tracking-tight">
              Welcome back
            </h1>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-zinc-600">
              Your account is active again and nothing was deleted. Your public profile stays
              unpublished until you publish it.
            </p>
            <div className="mt-6 flex w-full flex-col gap-2">
              <Link
                href="/dashboard"
                className="inline-flex h-10 items-center justify-center rounded-lg bg-violet-700 px-4 text-sm font-semibold text-white transition hover:bg-violet-800 focus-visible:ring-4 focus-visible:ring-violet-200"
              >
                Go to dashboard
              </Link>
              <Link
                href="/dashboard/profile"
                className="inline-flex h-10 items-center justify-center rounded-lg border border-violet-200 bg-white px-4 text-sm font-semibold text-violet-900 transition hover:bg-violet-50 focus-visible:ring-4 focus-visible:ring-violet-200"
              >
                Review your profile
              </Link>
            </div>
          </>
        ) : null}

        {view === "active" ? (
          <>
            <span className="flex size-14 items-center justify-center rounded-full bg-violet-100 text-violet-700">
              <ShieldCheck aria-hidden="true" className="size-6" />
            </span>
            <h1 className="mt-6 text-3xl font-extrabold leading-tight tracking-tight">
              Nothing to restore
            </h1>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-zinc-600">
              This account is active and no deletion is scheduled. If you followed an email link,
              it may have already been used.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex h-10 w-full items-center justify-center rounded-lg bg-violet-700 px-4 text-sm font-semibold text-white transition hover:bg-violet-800 focus-visible:ring-4 focus-visible:ring-violet-200"
            >
              Sign in
            </Link>
          </>
        ) : null}

        {view === "expired" ? (
          <>
            <span className="flex size-14 items-center justify-center rounded-full bg-red-100 text-red-700">
              <AlertCircle aria-hidden="true" className="size-6" />
            </span>
            <h1 className="mt-6 text-3xl font-extrabold leading-tight tracking-tight">
              This link has expired
            </h1>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-zinc-600">
              The 30-day grace period has ended, so this account can no longer be restored. You can
              create a new page with the same username if it is still available.
            </p>
            <Link
              href="/signup"
              className="mt-6 inline-flex h-10 w-full items-center justify-center rounded-lg bg-violet-700 px-4 text-sm font-semibold text-white transition hover:bg-violet-800 focus-visible:ring-4 focus-visible:ring-violet-200"
            >
              Create a new page
            </Link>
            <p className="mt-4 text-xs text-zinc-500">
              Need help?{" "}
              <a href="mailto:support@linkhub.app" className="font-semibold text-violet-800 underline">
                Contact support
              </a>
              .
            </p>
          </>
        ) : null}

        <p className="mt-6 border-t border-line pt-4 text-xs text-zinc-500">
          Deletion removes your profile, links, categories and analytics after the grace period.
        </p>
      </div>
    </AuthLayout>
  );
}
