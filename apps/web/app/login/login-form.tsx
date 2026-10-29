"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { loginSchema } from "@linkhub/shared";
import { AuthLayout, AuthPreviewCard } from "@/components/auth/auth-layout";
import { AuthAlert, PasswordInput, SubmitButton } from "@/components/auth/auth-form";
import { GoogleButton } from "@/components/auth/google-button";
import {
  GoogleSignupClaim,
  type GoogleSignupClaimData,
} from "@/components/auth/google-signup-claim";
import { Checkbox } from "@/components/ui/checkbox";
import { Input, Label, FieldError } from "@/components/ui/input";
import { formatFieldErrors, useAppData } from "@/lib/store";
import { formatDate } from "@/lib/utils";

export function LoginForm() {
  const router = useRouter();
  const { state, login, loginWithGoogle } = useAppData();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [deletionScheduledFor, setDeletionScheduledFor] = useState<string | null>(null);
  const [claim, setClaim] = useState<GoogleSignupClaimData | null>(null);
  const allowSignup = process.env.NEXT_PUBLIC_ALLOW_SIGNUP === "true";
  const googleEnabled = Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim());

  useEffect(() => {
    setDeletionScheduledFor(state.account.deletionScheduledFor);
  }, [state.account.deletionScheduledFor]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "preview") {
      setFormError("Demo preview is unavailable right now. Sign in to continue.");
    }
    const queryEmail = params.get("email");
    if (queryEmail) setEmail(queryEmail);
  }, []);

  const goToNext = () => {
    const nextParam = new URLSearchParams(window.location.search).get("next");
    let destination = "/dashboard";
    if (nextParam && !/[\u0000-\u001f\u007f\\]/.test(nextParam)) {
      try {
        // Resolve first, then compare origins. A prefix check alone lets
        // encoded tabs/newlines and backslashes turn into an external URL.
        const candidate = new URL(nextParam, window.location.origin);
        if (candidate.origin === window.location.origin) {
          destination = `${candidate.pathname}${candidate.search}${candidate.hash}`;
        }
      } catch {
        // Invalid URLs fall back to the dashboard.
      }
    }
    router.push(destination);
    router.refresh();
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    setErrors({});

    const parsed = loginSchema.safeParse({ email, password, remember });
    if (!parsed.success) {
      const fieldErrors: { email?: string; password?: string } = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === "email" || key === "password") fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    try {
      const result = await login(parsed.data);
      if (!result.ok) {
        const error = result.error;
        if (error?.code === "VALIDATION_ERROR") {
          const fieldErrors = formatFieldErrors(error.details);
          setErrors({
            email: fieldErrors.email,
            password: fieldErrors.password,
          });
        } else if (error?.code === "INVALID_CREDENTIALS") {
          setFormError("Email or password is incorrect.");
        } else if (error?.code === "ACCOUNT_SUSPENDED") {
          setFormError(error.message);
        } else if (error?.status === 429) {
          setFormError("Too many sign-in attempts. Wait a few minutes and try again.");
        } else {
          setFormError(error?.message ?? "Could not sign in. Try again.");
        }
        return;
      }

      goToNext();
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCredential = async (credential: string) => {
    setFormError("");
    setErrors({});
    setGoogleLoading(true);
    try {
      const result = await loginWithGoogle({ credential, remember });
      if (result.status === "signup_required") {
        if (!allowSignup) {
          setFormError(
            "Sign-ups are opening soon. Use your email and password to sign in.",
          );
          return;
        }
        setClaim({
          credential,
          email: result.email,
          displayName: result.displayName,
          suggestedUsername: result.suggestedUsername,
          remember,
        });
        return;
      }
      if (result.status === "error") {
        const error = result.error;
        if (
          error?.code === "GOOGLE_NOT_LINKED" ||
          error?.code === "GOOGLE_ACCOUNT_EXISTS"
        ) {
          setFormError(
            error.message ||
              "This Google account is not linked to a Link Hub account. Sign in with your password, then connect Google in Settings.",
          );
        } else if (error?.code === "GOOGLE_SIGN_IN_DISABLED") {
          setFormError("Google sign-in is not available right now. Use your email and password.");
        } else if (error?.code === "SIGNUP_DISABLED") {
          setFormError(
            "Sign-ups are opening soon. Use your email and password to sign in.",
          );
        } else if (error?.code === "GOOGLE_EMAIL_UNVERIFIED") {
          setFormError(error.message);
        } else if (error?.status === 429) {
          setFormError("Too many Google sign-in attempts. Wait a few minutes and try again.");
        } else {
          setFormError(error?.message ?? "Could not sign in with Google. Try again.");
        }
        return;
      }

      goToNext();
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <AuthLayout
      badge="Link Hub"
      title={
        <>
          All your links
          <br />
          in one place
        </>
      }
      description="Create a beautiful profile, share your work, and grow your audience."
      aside={<AuthPreviewCard />}
    >
      {claim ? (
        <GoogleSignupClaim
          claim={claim}
          onUseDifferentAccount={() => setClaim(null)}
          onSuccess={goToNext}
        />
      ) : (
        <>
      <h1 className="text-3xl font-extrabold tracking-tight">Welcome back</h1>
      <p className="mb-7 mt-1 text-sm text-zinc-600">
        Sign in to manage your links, analytics and profile.
      </p>

      {deletionScheduledFor ? (
        <AuthAlert tone="info">
          Your account is scheduled for deletion on {formatDate(deletionScheduledFor)}.{" "}
          <Link href="/restore-account" className="font-semibold underline">
            Restore it
          </Link>
          .
        </AuthAlert>
      ) : null}

      {googleEnabled ? (
        <div className="mb-6">
          <GoogleButton
            onCredential={handleGoogleCredential}
            disabled={loading || googleLoading}
            text="signin_with"
          />
          {googleLoading ? (
            <p role="status" className="mt-2 text-center text-sm text-zinc-600">
              Verifying your Google account…
            </p>
          ) : (
            <div className="mt-5 flex items-center gap-3 text-sm text-zinc-500">
              <span className="h-px flex-1 bg-zinc-200" />
              or continue with email
              <span className="h-px flex-1 bg-zinc-200" />
            </div>
          )}
        </div>
      ) : null}

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
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              className="pl-9"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setErrors((current) => ({ ...current, email: undefined }));
              }}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "email-error" : undefined}
              required
            />
          </div>
          <FieldError>{errors.email ? <span id="email-error">{errors.email}</span> : null}</FieldError>
        </div>

        <div className="mb-4">
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setErrors((current) => ({ ...current, password: undefined }));
            }}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? "password-error" : undefined}
            required
          />
          <FieldError>{errors.password ? <span id="password-error">{errors.password}</span> : null}</FieldError>
        </div>

        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <Checkbox
              id="remember"
              checked={remember}
              onCheckedChange={(checked) => setRemember(checked === true)}
              className="mt-0.5"
              aria-describedby="remember-hint"
            />
            <div>
              <Label htmlFor="remember" className="mb-0 cursor-pointer text-sm font-medium text-zinc-800">
                Remember me
              </Label>
              <p id="remember-hint" className="text-xs text-zinc-600">
                Stay signed in for 7 days; leave unchecked to sign out on close
              </p>
            </div>
          </div>
          <Link href="/forgot-password" className="shrink-0 text-sm font-semibold text-violet-800 hover:underline">
            Forgot password?
          </Link>
        </div>

        <AuthAlert>{formError}</AuthAlert>
        <SubmitButton loading={loading} disabled={googleLoading}>
          {loading ? "Signing in…" : "Sign in"}
        </SubmitButton>
      </form>

      {allowSignup ? (
        <p className="mt-6 text-center text-sm text-zinc-700">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-semibold text-violet-800 hover:underline">
            Sign up
          </Link>
        </p>
      ) : (
        <p className="mt-6 text-center text-sm font-medium text-zinc-700">Sign-ups opening soon</p>
      )}
        </>
      )}
    </AuthLayout>
  );
}
