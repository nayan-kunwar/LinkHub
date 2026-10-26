"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertCircle, Check } from "lucide-react";
import { AuthLayout, EnvelopeIllustration } from "@/components/auth/auth-layout";
import { ApiError, api } from "@/lib/api-client";
import { useAppData } from "@/lib/store";

type VerifyState = "verifying" | "success" | "expired" | "invalid" | "error";

interface VerifyResult {
  view: Exclude<VerifyState, "verifying" | "error">;
  message?: string;
}

/**
 * Token results are cached for the lifetime of the page so React Strict Mode's
 * double effect and fast remounts cannot consume the single-use token twice.
 */
const results = new Map<string, VerifyResult>();
const inFlight = new Map<string, Promise<VerifyResult>>();

async function runVerification(
  token: string,
  change: boolean,
): Promise<VerifyResult> {
  const cached = results.get(token);
  if (cached) return cached;
  const pending = inFlight.get(token);
  if (pending) return pending;

  const request = (async (): Promise<VerifyResult> => {
    try {
      if (change) {
        await api.auth.verifyEmailChange(token);
      } else {
        await api.auth.verifyEmail(token);
      }
      const result: VerifyResult = { view: "success" };
      results.set(token, result);
      return result;
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === "TOKEN_EXPIRED") {
          const result: VerifyResult = { view: "expired" };
          results.set(token, result);
          return result;
        }
        if (error.code === "TOKEN_INVALID") {
          const result: VerifyResult = { view: "invalid" };
          results.set(token, result);
          return result;
        }
        return { view: "invalid", message: error.message };
      }
      return {
        view: "invalid",
        message: "We could not verify this link. Check your connection and try again.",
      };
    } finally {
      inFlight.delete(token);
    }
  })();

  inFlight.set(token, request);
  return request;
}

export function VerifyEmailView() {
  const { status, refresh } = useAppData();
  const [view, setView] = useState<VerifyState>("verifying");
  const [change, setChange] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isChange = params.get("change") === "email";
    setChange(isChange);

    const statusParam = params.get("state");
    if (statusParam === "expired" || statusParam === "invalid") {
      setView("expired");
      return;
    }
    if (statusParam === "success") {
      setView("success");
      return;
    }

    const token = params.get("token");
    if (!token) {
      setView("invalid");
      return;
    }

    let cancelled = false;
    void runVerification(token, isChange).then(async (result) => {
      if (cancelled) return;
      if (result.view === "success" && status !== "anonymous") {
        await refresh();
      }
      if (cancelled) return;
      setMessage(result.message ?? "");
      setView(result.view);
    });

    return () => {
      cancelled = true;
    };
    // The token is read from the URL once; refresh/status changes must not
    // re-run verification.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signedIn = status === "authenticated" || status === "pending";
  const successCopy = change
    ? "Your new email address is confirmed. It is now the address on your account."
    : "You're all set. Your Link Hub page is ready to customize.";

  return (
    <AuthLayout
      badge="Verify email"
      title="Almost there!"
      description="Verify your email to activate your account and start using Link Hub."
      aside={
        <EnvelopeIllustration
          status={view === "expired" || view === "invalid" ? "expired" : "check"}
        />
      }
    >
      <div className="flex flex-col items-center text-center">
        {view === "verifying" ? (
          <>
            <span
              aria-hidden="true"
              className="mt-10 size-12 animate-spin rounded-full border-4 border-violet-100 border-t-violet-700"
            />
            <h1 className="mt-6 text-3xl font-extrabold tracking-tight">
              Verifying your email
            </h1>
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
            <h1 className="mt-6 text-3xl font-extrabold tracking-tight">
              {change ? "Email updated" : "Email verified"}
            </h1>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-zinc-600">
              {successCopy}
            </p>
            {signedIn ? (
              <Link
                href="/dashboard"
                className="mt-6 inline-flex h-10 w-full items-center justify-center rounded-lg bg-violet-700 px-4 text-sm font-semibold text-white transition hover:bg-violet-800 focus-visible:ring-4 focus-visible:ring-violet-200"
              >
                Go to dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="mt-6 inline-flex h-10 w-full items-center justify-center rounded-lg bg-violet-700 px-4 text-sm font-semibold text-white transition hover:bg-violet-800 focus-visible:ring-4 focus-visible:ring-violet-200"
                >
                  Sign in to continue
                </Link>
                <p className="mt-3 text-xs text-zinc-500">
                  Sign in with the email address you just verified.
                </p>
              </>
            )}
          </>
        ) : null}

        {view === "expired" ? (
          <>
            <span className="flex size-14 items-center justify-center rounded-full bg-red-100 text-red-700">
              <AlertCircle aria-hidden="true" className="size-6" />
            </span>
            <h1 className="mt-6 text-3xl font-extrabold leading-tight tracking-tight">
              Link expired
            </h1>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-zinc-600">
              This verification link has expired. Sign in and request a fresh one from the
              check-inbox page.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex h-10 w-full items-center justify-center rounded-lg bg-violet-700 px-4 text-sm font-semibold text-white transition hover:bg-violet-800 focus-visible:ring-4 focus-visible:ring-violet-200"
            >
              Sign in to resend
            </Link>
            <Link
              href="/check-inbox"
              className="mt-5 text-sm font-semibold text-violet-800 hover:underline"
            >
              ← Back to check inbox
            </Link>
          </>
        ) : null}

        {view === "invalid" ? (
          <>
            <span className="flex size-14 items-center justify-center rounded-full bg-amber-100 text-amber-800">
              <AlertCircle aria-hidden="true" className="size-6" />
            </span>
            <h1 className="mt-6 text-3xl font-extrabold leading-tight tracking-tight">
              Link already used or invalid
            </h1>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-zinc-600">
              {message ||
                "This link has already been used or is not valid. If your email is verified, sign in to continue."}
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex h-10 w-full items-center justify-center rounded-lg bg-violet-700 px-4 text-sm font-semibold text-white transition hover:bg-violet-800 focus-visible:ring-4 focus-visible:ring-violet-200"
            >
              Sign in
            </Link>
            <p className="mt-4 text-xs text-zinc-500">
              Still not verified?{" "}
              <Link
                href="/check-inbox"
                className="font-semibold text-violet-800 hover:underline"
              >
                Request a new link
              </Link>
              .
            </p>
          </>
        ) : null}

        {view === "error" ? (
          <>
            <span className="flex size-14 items-center justify-center rounded-full bg-red-100 text-red-700">
              <AlertCircle aria-hidden="true" className="size-6" />
            </span>
            <h1 className="mt-6 text-3xl font-extrabold leading-tight tracking-tight">
              Something went wrong
            </h1>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-zinc-600">
              {message || "We could not verify this link. Try again in a moment."}
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex h-10 w-full items-center justify-center rounded-lg bg-violet-700 px-4 text-sm font-semibold text-white transition hover:bg-violet-800 focus-visible:ring-4 focus-visible:ring-violet-200"
            >
              Back to sign in
            </Link>
          </>
        ) : null}
      </div>
    </AuthLayout>
  );
}
