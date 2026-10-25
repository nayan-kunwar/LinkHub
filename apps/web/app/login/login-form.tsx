"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { loginSchema } from "@linkhub/shared";
import { AuthLayout, AuthPreviewCard } from "@/components/auth/auth-layout";
import { AuthAlert, PasswordInput, SubmitButton } from "@/components/auth/auth-form";
import { Checkbox } from "@/components/ui/checkbox";
import { Input, Label, FieldError } from "@/components/ui/input";
import { useMockData } from "@/lib/store";
import { startDemoSession } from "@/lib/auth";
import { formatDate } from "@/lib/utils";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function LoginForm() {
  const router = useRouter();
  const { state } = useMockData();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [deletionScheduledFor, setDeletionScheduledFor] = useState<string | null>(null);
  const allowSignup = process.env.NEXT_PUBLIC_ALLOW_SIGNUP !== "false";

  useEffect(() => {
    setDeletionScheduledFor(state.account.deletionScheduledFor);
  }, [state.account.deletionScheduledFor]);

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
    await wait(650);

    if (password === "wrong") {
      setLoading(false);
      setFormError("Incorrect email or password.");
      return;
    }

    startDemoSession(parsed.data.email, state.profile.displayName);
    const nextParam = new URLSearchParams(window.location.search).get("next");
    const destination = nextParam?.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/dashboard";
    router.push(destination);
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
                Stay signed in for 7 days
              </p>
            </div>
          </div>
          <Link href="/forgot-password" className="shrink-0 text-sm font-semibold text-violet-800 hover:underline">
            Forgot password?
          </Link>
        </div>

        <AuthAlert>{formError}</AuthAlert>
        <SubmitButton loading={loading}>{loading ? "Signing in…" : "Sign in"}</SubmitButton>
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

      <p className="mt-4 rounded-lg bg-zinc-50 px-3 py-2 text-center text-[11px] leading-relaxed text-zinc-500">
        UI preview: use any email and password to sign in. Type <span className="font-semibold">wrong</span> as
        the password to see the error state.
      </p>
    </AuthLayout>
  );
}
