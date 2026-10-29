"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, AtSign, CheckCircle2, Mail, User } from "lucide-react";
import {
  LIMITS,
  RESERVED_USERNAMES,
  USERNAME_REGEX,
  signupSchema,
} from "@linkhub/shared";
import {
  AuthAlert,
  PasswordChecklist,
  PasswordInput,
  SubmitButton,
} from "@/components/auth/auth-form";
import { Input, Label, FieldError, FieldHint } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api-client";
import { formatFieldErrors } from "@/lib/store";

const COMMON_PASSWORDS = [
  "password",
  "password1",
  "password123",
  "password1234",
  "123456789012",
  "qwertyuiop12",
  "iloveyou1234",
  "letmein12345",
  "welcome12345",
  "qwerty123456",
  "abc123456789",
  "passw0rd1234",
  "admin1234567",
  "football1234",
  "monkey123456",
];

type FieldKey =
  | "displayName"
  | "username"
  | "email"
  | "password"
  | "confirmPassword";

export function EmailSignupForm({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const [availability, setAvailability] = useState<
    "idle" | "checking" | "available" | "taken" | "reserved"
  >("idle");
  const [values, setValues] = useState({
    displayName: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  const normalizedUsername = values.username.trim().toLowerCase();
  const usernameReserved = (RESERVED_USERNAMES as readonly string[]).includes(
    normalizedUsername,
  );
  const usernameLooksValid =
    normalizedUsername.length >= 3 &&
    normalizedUsername.length <= 30 &&
    USERNAME_REGEX.test(normalizedUsername) &&
    !usernameReserved;
  const usernameTaken =
    availability === "taken" || availability === "reserved";
  const usernameAvailable = availability === "available";

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

  const rules = useMemo(
    () => [
      {
        key: "length",
        label: `${LIMITS.minPassword}+ characters`,
        met: values.password.length >= LIMITS.minPassword,
      },
      {
        key: "common",
        label: "Not a common password",
        met:
          values.password.length > 0 &&
          !COMMON_PASSWORDS.includes(values.password.toLowerCase()),
      },
      {
        key: "match",
        label: "Matches confirm password",
        met:
          values.password.length > 0 &&
          values.password === values.confirmPassword,
      },
    ],
    [values.password, values.confirmPassword],
  );

  const update = (key: FieldKey, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setFormError("");
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    setErrors({});

    const parsed = signupSchema.safeParse(values);
    if (!parsed.success) {
      const nextErrors: Partial<Record<FieldKey, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as FieldKey;
        if (!nextErrors[key]) nextErrors[key] = issue.message;
      }
      setErrors(nextErrors);
      return;
    }

    if (availability === "taken") {
      setErrors({ username: "That username is already taken." });
      return;
    }
    if (availability === "reserved") {
      setErrors({ username: "That username is reserved." });
      return;
    }

    setLoading(true);
    try {
      await api.auth.register(parsed.data);
      router.push(
        `/check-inbox?email=${encodeURIComponent(parsed.data.email)}&username=${encodeURIComponent(parsed.data.username)}`,
      );
    } catch (error) {
      if (error instanceof ApiError) {
        if (
          error.code === "USERNAME_TAKEN" ||
          error.code === "USERNAME_RESERVED"
        ) {
          setErrors({ username: error.message });
          setAvailability(
            error.code === "USERNAME_RESERVED" ? "reserved" : "taken",
          );
        } else if (error.code === "VALIDATION_ERROR") {
          const fields = formatFieldErrors(error.details) as Partial<
            Record<FieldKey, string>
          >;
          setErrors(fields);
          if (Object.keys(fields).length > 0) {
            const first = Object.keys(fields)[0];
            document.getElementById(first)?.focus();
          }
        } else if (error.code === "SIGNUP_DISABLED") {
          setFormError(error.message);
        } else if (error.status === 429) {
          setFormError("Too many sign-up attempts. Try again later.");
        } else {
          setFormError(error.message);
        }
      } else {
        setFormError("Could not create your account. Try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-violet-800 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back
      </button>

      <h1 className="text-3xl font-extrabold tracking-tight">
        Create your account
      </h1>
      <p className="mb-5 mt-1 text-sm text-zinc-600">
        Join Link Hub and start building your profile.
      </p>

      <form onSubmit={submit} noValidate>
        <div className="mb-3.5">
          <Label htmlFor="displayName">Full name</Label>
          <div className="relative">
            <User
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500"
            />
            <Input
              id="displayName"
              name="displayName"
              autoComplete="name"
              placeholder="Nayan Kunwar"
              className="pl-9"
              value={values.displayName}
              onChange={(event) => update("displayName", event.target.value)}
              aria-invalid={Boolean(errors.displayName)}
              aria-describedby={
                errors.displayName ? "displayName-error" : undefined
              }
              maxLength={LIMITS.maxDisplayName}
            />
          </div>
          <FieldError>
            {errors.displayName ? (
              <span id="displayName-error">{errors.displayName}</span>
            ) : null}
          </FieldError>
        </div>

        <div className="mb-3.5">
          <Label htmlFor="username">Username</Label>
          <div className="relative">
            <AtSign
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500"
            />
            <Input
              id="username"
              name="username"
              autoComplete="username"
              placeholder="nayankunwar"
              className="pl-9 pr-10 lowercase"
              value={values.username}
              onChange={(event) =>
                update("username", event.target.value.toLowerCase())
              }
              aria-invalid={Boolean(errors.username) || usernameTaken}
              aria-describedby="username-hint username-error"
              maxLength={30}
              spellCheck={false}
            />
            {usernameAvailable ? (
              <CheckCircle2
                aria-hidden="true"
                className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-green-600"
              />
            ) : null}
          </div>
          <FieldHint>
            <span id="username-hint">
              link.nayankunwar.com/
              <span className="font-semibold">
                {normalizedUsername || "username"}
              </span>
              <br />
              3–30 characters: lowercase letters, numbers and hyphens
            </span>
          </FieldHint>
          <FieldError>
            {errors.username || usernameTaken ? (
              <span id="username-error">
                {errors.username ??
                  (availability === "reserved"
                    ? "That username is reserved."
                    : "That username is already taken.")}
              </span>
            ) : null}
          </FieldError>
        </div>

        <div className="mb-3.5">
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
              value={values.email}
              onChange={(event) => update("email", event.target.value)}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "email-error" : undefined}
            />
          </div>
          <FieldError>
            {errors.email ? <span id="email-error">{errors.email}</span> : null}
          </FieldError>
        </div>

        <div className="mb-2 grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="password">Password</Label>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="new-password"
              placeholder="12+ characters"
              value={values.password}
              onChange={(event) => update("password", event.target.value)}
              aria-invalid={Boolean(errors.password)}
              aria-describedby="password-rules password-error"
              maxLength={LIMITS.maxPassword}
            />
            <FieldError>
              {errors.password ? (
                <span id="password-error">{errors.password}</span>
              ) : null}
            </FieldError>
          </div>
          <div>
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <PasswordInput
              id="confirmPassword"
              name="confirmPassword"
              autoComplete="new-password"
              placeholder="Confirm password"
              value={values.confirmPassword}
              onChange={(event) =>
                update("confirmPassword", event.target.value)
              }
              aria-invalid={Boolean(errors.confirmPassword)}
              aria-describedby="password-rules confirmPassword-error"
              maxLength={LIMITS.maxPassword}
            />
            <FieldError>
              {errors.confirmPassword ? (
                <span id="confirmPassword-error">
                  {errors.confirmPassword}
                </span>
              ) : null}
            </FieldError>
          </div>
        </div>

        <div id="password-rules">
          <PasswordChecklist rules={rules} />
        </div>

        <div className="mt-5">
          <AuthAlert>{formError}</AuthAlert>
          <SubmitButton loading={loading}>
            {loading ? "Creating account…" : "Create account"}
          </SubmitButton>
        </div>

        <p className="mt-3 text-center text-[11px] leading-relaxed text-zinc-500">
          By creating an account you agree to our{" "}
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
      </form>

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
  );
}
