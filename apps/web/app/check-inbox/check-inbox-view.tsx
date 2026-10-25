"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { AuthLayout, EnvelopeIllustration } from "@/components/auth/auth-layout";
import { AuthAlert, SubmitButton } from "@/components/auth/auth-form";
import { Input, Label, FieldError } from "@/components/ui/input";
import { useMockData } from "@/lib/store";

export function CheckInboxView() {
  const { state, setPendingEmail } = useMockData();
  const [email, setEmail] = useState(state.account.email);
  const [changeMode, setChangeMode] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryEmail = params.get("email");
    if (queryEmail) {
      setEmail(queryEmail);
      setCooldown(60);
    }
    if (params.get("change") === "1") {
      setChangeMode(true);
      setNewEmail(queryEmail ?? state.account.email);
    }
  }, [state.account.email]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const resend = () => {
    if (cooldown > 0) return;
    setCooldown(60);
    toast.success(`Verification email sent to ${email}`);
  };

  const changeEmail = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = newEmail.trim();
    if (!/^\S+@\S+\.\S+$/.test(value)) {
      setError("Enter a valid email address.");
      return;
    }
    setError("");
    setEmail(value);
    setPendingEmail(value);
    setChangeMode(false);
    setCooldown(60);
    toast.success(`Verification email sent to ${value}`);
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
      aside={<EnvelopeIllustration />}
    >
      {changeMode ? (
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Change your email</h1>
          <p className="mb-6 mt-1 text-sm text-zinc-600">We&apos;ll send a new verification link to this address.</p>
          <form onSubmit={changeEmail} noValidate>
            <div className="mb-4">
              <Label htmlFor="new-email">New email</Label>
              <div className="relative">
                <Mail
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500"
                />
                <Input
                  id="new-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="pl-9"
                  value={newEmail}
                  onChange={(event) => {
                    setNewEmail(event.target.value);
                    setError("");
                  }}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? "new-email-error" : undefined}
                />
              </div>
              <FieldError>{error ? <span id="new-email-error">{error}</span> : null}</FieldError>
            </div>
            <AuthAlert>{error ? "" : ""}</AuthAlert>
            <SubmitButton>Update and resend</SubmitButton>
          </form>
          <p className="mt-6 text-center text-sm">
            <button
              type="button"
              onClick={() => {
                setChangeMode(false);
                setError("");
              }}
              className="font-semibold text-violet-800 hover:underline"
            >
              Cancel
            </button>
          </p>
        </div>
      ) : (
        <div>
          <span className="flex size-12 items-center justify-center rounded-full bg-violet-100 text-violet-700">
            <Mail aria-hidden="true" className="size-5" />
          </span>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight">Check your inbox</h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600">
            We sent a verification link to <span className="font-semibold text-zinc-800">{email}</span>. Click it
            to activate your account.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600">
            Don&apos;t see it? Check your spam or promotions folder. The link expires in 24 hours.
          </p>
          <button
            type="button"
            onClick={resend}
            disabled={cooldown > 0}
            className="mt-6 inline-flex h-10 w-full items-center justify-center rounded-lg bg-zinc-400 px-4 text-sm font-semibold text-white transition hover:bg-zinc-500 disabled:cursor-not-allowed disabled:bg-zinc-400"
          >
            {cooldown > 0 ? `Resend email in ${cooldown}s` : "Resend email"}
          </button>
          <p className="mt-5 text-sm text-zinc-700">
            Wrong email?{" "}
            <button
              type="button"
              onClick={() => {
                setNewEmail(email);
                setChangeMode(true);
              }}
              className="font-semibold text-violet-800 hover:underline"
            >
              Change it
            </button>
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
