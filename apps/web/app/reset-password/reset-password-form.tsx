"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Check } from "lucide-react";
import { LIMITS, resetPasswordSchema } from "@linkhub/shared";
import { AuthLayout, LockIllustration } from "@/components/auth/auth-layout";
import {
  AuthAlert,
  PasswordChecklist,
  PasswordInput,
  SubmitButton,
} from "@/components/auth/auth-form";
import { Label, FieldError } from "@/components/ui/input";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const COMMON_PASSWORDS = [
  "password1234",
  "password12345",
  "123456789012",
  "qwertyuiop12",
  "letmein12345",
  "welcome12345",
  "qwerty123456",
  "abc123456789",
  "passw0rd1234",
  "admin1234567",
];

type ViewState = "form" | "success" | "expired";

export function ResetPasswordForm() {
  const [view, setView] = useState<ViewState>("form");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const state = params.get("state");
    if (state === "expired" || token === "expired" || token === "invalid") {
      setView("expired");
    }
  }, []);

  const rules = useMemo(
    () => [
      {
        key: "length",
        label: `${LIMITS.minPassword}+ characters`,
        met: password.length >= LIMITS.minPassword,
      },
      {
        key: "common",
        label: "Not a common password",
        met: password.length > 0 && !COMMON_PASSWORDS.includes(password.toLowerCase()),
      },
      {
        key: "match",
        label: "Matches confirm password",
        met: password.length > 0 && password === confirmPassword,
      },
    ],
    [password, confirmPassword],
  );

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});
    const parsed = resetPasswordSchema.safeParse({ password, confirmPassword });
    if (!parsed.success) {
      const nextErrors: typeof errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === "password" || key === "confirmPassword") {
          nextErrors[key] = issue.message;
        }
      }
      setErrors(nextErrors);
      return;
    }
    setLoading(true);
    await wait(850);
    setLoading(false);
    setView("success");
  };

  return (
    <AuthLayout
      badge="New password"
      title={
        <>
          Choose a strong
          <br />
          password
        </>
      }
      description="A long passphrase is easier to remember and harder to guess. No forced symbols required."
      aside={<LockIllustration />}
    >
      {view === "expired" ? (
        <div>
          <span className="flex size-12 items-center justify-center rounded-full bg-red-100 text-red-700">
            <AlertCircle aria-hidden="true" className="size-5" />
          </span>
          <h1 className="mt-5 text-3xl font-extrabold leading-tight tracking-tight">
            This link is invalid or expired
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600">
            Reset links work once and expire after 1 hour. Request a new one to continue.
          </p>
          <Link
            href="/forgot-password"
            className="mt-6 inline-flex h-10 w-full items-center justify-center rounded-lg bg-violet-700 px-4 text-sm font-semibold text-white transition hover:bg-violet-800 focus-visible:ring-4 focus-visible:ring-violet-200"
          >
            Request a new link
          </Link>
          <p className="mt-6 text-center text-sm">
            <Link href="/login" className="font-semibold text-violet-800 hover:underline">
              ← Back to sign in
            </Link>
          </p>
        </div>
      ) : view === "success" ? (
        <div>
          <span className="flex size-12 items-center justify-center rounded-full bg-green-100 text-green-700">
            <Check aria-hidden="true" className="size-5" strokeWidth={3} />
          </span>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight">Password updated</h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600">
            Your password has been changed and other sessions were signed out.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex h-10 w-full items-center justify-center rounded-lg bg-violet-700 px-4 text-sm font-semibold text-white transition hover:bg-violet-800 focus-visible:ring-4 focus-visible:ring-violet-200"
          >
            Sign in
          </Link>
        </div>
      ) : (
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Set a new password</h1>
          <p className="mb-7 mt-1 text-sm text-zinc-600">Enter a new password for your account.</p>
          <form onSubmit={submit} noValidate>
            <div className="mb-4">
              <Label htmlFor="password">New password</Label>
              <PasswordInput
                id="password"
                autoComplete="new-password"
                placeholder="At least 12 characters"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setErrors((current) => ({ ...current, password: undefined }));
                }}
                aria-invalid={Boolean(errors.password)}
                aria-describedby="password-rules password-error"
                maxLength={LIMITS.maxPassword}
              />
              <FieldError>
                {errors.password ? <span id="password-error">{errors.password}</span> : null}
              </FieldError>
            </div>
            <div className="mb-2">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <PasswordInput
                id="confirmPassword"
                autoComplete="new-password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  setErrors((current) => ({ ...current, confirmPassword: undefined }));
                }}
                aria-invalid={Boolean(errors.confirmPassword)}
                aria-describedby="password-rules confirmPassword-error"
                maxLength={LIMITS.maxPassword}
              />
              <FieldError>
                {errors.confirmPassword ? (
                  <span id="confirmPassword-error">{errors.confirmPassword}</span>
                ) : null}
              </FieldError>
            </div>
            <div id="password-rules">
              <PasswordChecklist rules={rules} />
            </div>
            <AuthAlert>{errors.form}</AuthAlert>
            <SubmitButton loading={loading} className="mt-6">
              {loading ? "Updating…" : "Reset password"}
            </SubmitButton>
          </form>
          <p className="mt-5 text-center text-sm">
            <Link href="/login" className="font-semibold text-violet-800 hover:underline">
              ← Back to sign in
            </Link>
          </p>
        </div>
      )}
    </AuthLayout>
  );
}
