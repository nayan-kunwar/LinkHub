"use client";

import Link from "next/link";
import { useState } from "react";
import { Mail } from "lucide-react";
import { forgotPasswordSchema } from "@linkhub/shared";
import { AuthLayout, EnvelopeIllustration } from "@/components/auth/auth-layout";
import { AuthAlert, SubmitButton } from "@/components/auth/auth-form";
import { Input, Label, FieldError } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api-client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const startCooldown = () => {
    setCooldown(60);
    const interval = window.setInterval(() => {
      setCooldown((current) => {
        if (current <= 1) {
          window.clearInterval(interval);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
  };

  const send = async () => {
    setError("");
    setFormError("");
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      await api.auth.forgotPassword(parsed.data.email);
      setSent(true);
      startCooldown();
    } catch (caught) {
      if (caught instanceof ApiError) {
        setFormError(
          caught.status === 429
            ? "Too many reset requests. Wait a few minutes and try again."
            : caught.message,
        );
      } else {
        setFormError("Could not send the reset link. Try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await send();
  };

  const resend = () => {
    if (cooldown > 0 || loading) return;
    void send();
  };

  return (
    <AuthLayout
      badge="Reset password"
      title={
        <>
          Get back to
          <br />
          your account
        </>
      }
      description="We'll send you a secure link to reset your password."
      aside={<EnvelopeIllustration status="lock" />}
    >
      {sent ? (
        <div>
          <span className="flex size-12 items-center justify-center rounded-full bg-green-100 text-green-700">
            <Mail aria-hidden="true" className="size-5" />
          </span>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight">Check your email</h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600">
            If an account exists for <span className="font-semibold text-zinc-800">{email}</span>, we&apos;ve
            sent a reset link. It expires in 1 hour.
          </p>
          <p className="mt-2 text-sm text-zinc-600">Can&apos;t find it? Check your spam or promotions folder.</p>
          <AuthAlert>{formError}</AuthAlert>
          <button
            type="button"
            onClick={resend}
            disabled={cooldown > 0 || loading}
            className="mt-6 inline-flex h-10 w-full items-center justify-center rounded-lg border border-violet-300 bg-white px-4 text-sm font-semibold text-violet-900 transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:border-zinc-300 disabled:text-zinc-500"
          >
            {loading
              ? "Sending…"
              : cooldown > 0
                ? `Resend link in ${cooldown}s`
                : "Resend link"}
          </button>
          <p className="mt-6 text-center text-sm">
            <Link href="/login" className="font-semibold text-violet-800 hover:underline">
              ← Back to sign in
            </Link>
          </p>
        </div>
      ) : (
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Forgot your password?</h1>
          <p className="mb-7 mt-2 text-sm leading-relaxed text-zinc-600">
            Enter your email and we&apos;ll send you a reset link if an account exists.
          </p>
          <form onSubmit={submit} noValidate>
            <div className="mb-4">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500"
                />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="pl-9"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setError("");
                  }}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? "email-error" : undefined}
                />
              </div>
              <FieldError>{error ? <span id="email-error">{error}</span> : null}</FieldError>
            </div>
            <AuthAlert>{formError}</AuthAlert>
            <SubmitButton loading={loading}>{loading ? "Sending…" : "Send reset link"}</SubmitButton>
          </form>
          <p className="mt-6 text-center text-sm">
            <Link href="/login" className="font-semibold text-violet-800 hover:underline">
              ← Back to sign in
            </Link>
          </p>
        </div>
      )}
    </AuthLayout>
  );
}
