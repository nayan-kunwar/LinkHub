"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { AuthLayout, AuthPreviewCard } from "@/components/auth/auth-layout";
import { AuthAlert } from "@/components/auth/auth-form";
import { GoogleButton } from "@/components/auth/google-button";
import {
  GoogleSignupClaim,
  type GoogleSignupClaimData,
} from "@/components/auth/google-signup-claim";
import { Button } from "@/components/ui/button";
import { useAppData } from "@/lib/store";
import { EmailSignupForm } from "./email-signup-form";

type Mode = "entry" | "claim" | "email";

export function SignupForm() {
  const router = useRouter();
  const { loginWithGoogle } = useAppData();
  const [mode, setMode] = useState<Mode>("entry");
  const [claim, setClaim] = useState<GoogleSignupClaimData | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [formErrorCode, setFormErrorCode] = useState("");
  const allowSignup = process.env.NEXT_PUBLIC_ALLOW_SIGNUP === "true";
  const googleEnabled = Boolean(
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim(),
  );

  useEffect(() => {
    if (!allowSignup) router.replace("/login");
  }, [allowSignup, router]);

  const goToDashboard = () => {
    router.push("/dashboard");
    router.refresh();
  };

  const useDifferentAccount = () => {
    setClaim(null);
    setMode("entry");
    setFormError("");
    setFormErrorCode("");
  };

  const handleGoogleCredential = async (credential: string) => {
    setFormError("");
    setFormErrorCode("");
    setGoogleLoading(true);
    try {
      const result = await loginWithGoogle({ credential });
      if (result.status === "signup_required") {
        setClaim({
          credential,
          email: result.email,
          displayName: result.displayName,
          suggestedUsername: result.suggestedUsername,
        });
        setMode("claim");
        return;
      }
      if (result.status === "error") {
        const error = result.error;
        if (
          error?.code === "GOOGLE_ACCOUNT_EXISTS" ||
          error?.code === "SIGNUP_DISABLED" ||
          error?.code === "GOOGLE_EMAIL_UNVERIFIED" ||
          error?.code === "GOOGLE_SIGN_IN_DISABLED"
        ) {
          setFormError(error.message);
          setFormErrorCode(error.code);
        } else if (error?.status === 429) {
          setFormError(
            "Too many Google sign-up attempts. Wait a few minutes and try again.",
          );
        } else {
          setFormError(
            error?.message ?? "Could not continue with Google. Try again.",
          );
        }
        return;
      }

      goToDashboard();
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <AuthLayout
      badge="Link Hub"
      title={
        <>
          Your links, your name,
          <br />
          your corner of the internet.
        </>
      }
      description="Create a beautiful profile, share your work, and grow your audience."
      aside={<AuthPreviewCard />}
    >
      {mode === "claim" && claim ? (
        <GoogleSignupClaim
          claim={claim}
          onUseDifferentAccount={useDifferentAccount}
          onSuccess={goToDashboard}
        />
      ) : mode === "email" ? (
        <EmailSignupForm onBack={() => setMode("entry")} />
      ) : (
        <>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Create your Link Hub
          </h1>
          <p className="mb-6 mt-1 text-sm text-zinc-600">
            {googleEnabled
              ? "One profile for everything you share. Start with Google — no password needed."
              : "One profile for everything you share. Create your account with email."}
          </p>

          <AuthAlert>{formError}</AuthAlert>
          {formErrorCode === "GOOGLE_ACCOUNT_EXISTS" ? (
            <p className="-mt-1 mb-4 text-sm text-zinc-700">
              <Link
                href="/login"
                className="font-semibold text-violet-800 hover:underline"
              >
                Sign in with your password
              </Link>{" "}
              and connect Google in Settings.
            </p>
          ) : null}

          {googleEnabled ? (
            <div>
              <GoogleButton
                onCredential={handleGoogleCredential}
                disabled={googleLoading}
                text="continue_with"
                context="signup"
              />
              <p className="mt-2 text-center text-xs text-zinc-500">
                Next, you&rsquo;ll pick the URL people will remember.
              </p>
              {googleLoading ? (
                <p
                  role="status"
                  className="mt-4 text-center text-sm text-zinc-600"
                >
                  Checking your Google account…
                </p>
              ) : (
                <div className="mt-5 flex items-center gap-3 text-sm text-zinc-500">
                  <span className="h-px flex-1 bg-zinc-200" />
                  or sign up with email
                  <span className="h-px flex-1 bg-zinc-200" />
                </div>
              )}
            </div>
          ) : null}

          <Button
            type="button"
            variant="secondary"
            size="lg"
            className={googleEnabled ? "mt-5 w-full" : "mt-2 w-full"}
            onClick={() => setMode("email")}
          >
            <Mail aria-hidden="true" className="size-4" />
            Sign up with email
          </Button>

          <p className="mt-4 text-center text-[11px] leading-relaxed text-zinc-500">
            By continuing you agree to our{" "}
            <Link
              href="/terms"
              className="font-semibold text-violet-800 hover:underline"
            >
              Terms
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              className="font-semibold text-violet-800 hover:underline"
            >
              Privacy Policy
            </Link>
            .
          </p>

          <p className="mt-4 text-center text-sm text-zinc-700">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-violet-800 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </>
      )}
    </AuthLayout>
  );
}
