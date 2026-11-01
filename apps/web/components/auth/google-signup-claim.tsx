"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import {
  RESERVED_USERNAMES,
  USERNAME_REGEX,
  googleSignupSchema,
} from "@linkhub/shared";
import { AuthAlert, SubmitButton } from "@/components/auth/auth-form";
import { Avatar } from "@/components/avatar";
import { FieldError, FieldHint, Label } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { formatFieldErrors, useAppData } from "@/lib/store";

const PUBLIC_HOST = (
  process.env.NEXT_PUBLIC_APP_URL ?? "https://link.nayankunwar.com"
)
  .replace(/^https?:\/\//, "")
  .replace(/\/$/, "");

export interface GoogleSignupClaimData {
  credential: string;
  email: string;
  displayName: string;
  suggestedUsername: string;
  remember?: boolean;
}

type Availability = "idle" | "checking" | "available" | "taken" | "reserved";

export function GoogleSignupClaim({
  claim,
  onUseDifferentAccount,
  onSuccess,
}: {
  claim: GoogleSignupClaimData;
  onUseDifferentAccount: () => void;
  onSuccess: () => void;
}) {
  const { signupWithGoogle } = useAppData();
  const [username, setUsername] = useState(claim.suggestedUsername);
  const [availability, setAvailability] = useState<Availability>("idle");
  const [usernameError, setUsernameError] = useState("");
  const [formError, setFormError] = useState("");
  const [formErrorCode, setFormErrorCode] = useState("");
  const [loading, setLoading] = useState(false);

  const normalizedUsername = username.trim().toLowerCase();
  const usernameReserved = (RESERVED_USERNAMES as readonly string[]).includes(
    normalizedUsername,
  );
  const usernameLooksValid =
    normalizedUsername.length >= 3 &&
    normalizedUsername.length <= 30 &&
    USERNAME_REGEX.test(normalizedUsername) &&
    !usernameReserved;

  useEffect(() => {
    if (usernameReserved) {
      setAvailability("reserved");
      return;
    }
    if (!usernameLooksValid) {
      setAvailability("idle");
      return;
    }

    setAvailability("checking");
    let cancelled = false;
    const timer = window.setTimeout(() => {
      api.usernames
        .availability(normalizedUsername)
        .then((result) => {
          if (cancelled) return;
          setAvailability(
            result.available
              ? "available"
              : result.reason === "reserved"
                ? "reserved"
                : "taken",
          );
        })
        .catch(() => {
          if (!cancelled) setAvailability("idle");
        });
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [normalizedUsername, usernameLooksValid, usernameReserved]);

  const updateUsername = (value: string) => {
    setUsername(value.toLowerCase());
    setUsernameError("");
    setFormError("");
    setFormErrorCode("");
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setUsernameError("");
    setFormError("");
    setFormErrorCode("");

    const parsed = googleSignupSchema.safeParse({ username });
    if (!parsed.success) {
      setUsernameError(parsed.error.issues[0]?.message ?? "Choose a username.");
      return;
    }
    if (availability === "taken") {
      setUsernameError("That username is already taken.");
      return;
    }
    if (availability === "reserved") {
      setUsernameError("That username is reserved.");
      return;
    }

    setLoading(true);
    try {
      const result = await signupWithGoogle({
        credential: claim.credential,
        username: parsed.data.username,
        remember: claim.remember,
      });
      if (!result.ok) {
        const error = result.error;
        if (
          error?.code === "USERNAME_TAKEN" ||
          error?.code === "USERNAME_RESERVED"
        ) {
          setUsernameError(error.message);
          setAvailability(
            error.code === "USERNAME_RESERVED" ? "reserved" : "taken",
          );
        } else if (error?.code === "VALIDATION_ERROR") {
          setUsernameError(
            formatFieldErrors(error.details).username ??
              "Choose a valid username.",
          );
        } else if (
          error?.code === "GOOGLE_ACCOUNT_EXISTS" ||
          error?.code === "GOOGLE_ALREADY_LINKED" ||
          error?.code === "SIGNUP_DISABLED"
        ) {
          setFormError(error.message);
          setFormErrorCode(error.code);
        } else if (error?.status === 429) {
          setFormError(
            "Too many sign-up attempts. Wait a few minutes and try again.",
          );
        } else {
          setFormError(error?.message ?? "Could not create your Link Hub.");
        }
        return;
      }

      onSuccess();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center gap-3 rounded-xl border border-violet-100 bg-violet-50/70 px-3 py-2.5">
        <Avatar
          name={claim.displayName}
          className="size-9 text-sm"
          ring={false}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-zinc-900">
            {claim.displayName}
          </p>
          <p className="truncate text-xs text-zinc-600">{claim.email}</p>
        </div>
        <button
          type="button"
          onClick={onUseDifferentAccount}
          className="shrink-0 text-sm font-semibold text-violet-800 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200"
        >
          Switch
        </button>
      </div>

      <h1 className="text-3xl font-extrabold tracking-tight">
        Choose your LinkHub URL
      </h1>
      <p className="mb-6 mt-1 text-sm text-zinc-600">
        This is the link you&rsquo;ll share. You can change it later.
      </p>

      <form onSubmit={submit} noValidate>
        <div className="mb-1.5">
          <Label htmlFor="claim-username">Your public URL</Label>
        </div>
        <div
          className={`flex h-10 overflow-hidden rounded-lg border bg-white shadow-[0_1px_1px_rgba(24,24,27,0.02)] transition focus-within:ring-4 ${
            usernameError || availability === "taken" || availability === "reserved"
              ? "border-red-600 focus-within:ring-red-100"
              : "border-zinc-300 focus-within:border-violet-500 focus-within:ring-violet-100"
          }`}
        >
          <span className="flex max-w-[55%] items-center truncate border-r border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-600">
            {PUBLIC_HOST}/
          </span>
          <input
            id="claim-username"
            name="username"
            autoComplete="username"
            className="h-full min-w-0 flex-1 bg-white px-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-500"
            placeholder="username"
            value={username}
            onChange={(event) => updateUsername(event.target.value)}
            aria-invalid={
              Boolean(usernameError) ||
              availability === "taken" ||
              availability === "reserved"
            }
            aria-describedby="claim-username-hint claim-username-error"
            maxLength={30}
            spellCheck={false}
            autoFocus
          />
          {availability === "available" ? (
            <CheckCircle2
              aria-hidden="true"
              className="mr-3 size-4 shrink-0 self-center text-green-600"
            />
          ) : null}
        </div>
        <FieldHint>
          {availability === "checking" ? (
            <span id="claim-username-hint">Checking availability…</span>
          ) : availability === "available" ? (
            <span id="claim-username-hint" className="text-green-800">
              Available — this will be your public profile link.
            </span>
          ) : (
            <span id="claim-username-hint">
              3–30 characters: lowercase letters, numbers and hyphens
            </span>
          )}
        </FieldHint>
        <FieldError>
          {usernameError ||
          availability === "taken" ||
          availability === "reserved" ? (
            <span id="claim-username-error">
              {usernameError ||
                (availability === "reserved"
                  ? "That username is reserved."
                  : "That username is already taken.")}
            </span>
          ) : null}
        </FieldError>

        <div className="mt-5">
          <AuthAlert>{formError}</AuthAlert>
          {formErrorCode === "GOOGLE_ACCOUNT_EXISTS" ? (
            <p className="mb-4 text-sm text-zinc-700">
              <Link
                href="/login"
                className="font-semibold text-violet-800 hover:underline"
              >
                Sign in with your password
              </Link>{" "}
              and connect Google in Settings.
            </p>
          ) : null}
          <SubmitButton loading={loading}>
            {loading ? "Creating your Link Hub…" : "Create my Link Hub"}
          </SubmitButton>
        </div>
      </form>

      <button
        type="button"
        onClick={onUseDifferentAccount}
        className="mt-4 w-full text-center text-sm font-semibold text-violet-800 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200"
      >
        Use a different Google account
      </button>

      <p className="mt-3 text-center text-[11px] leading-relaxed text-zinc-500">
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
    </div>
  );
}
