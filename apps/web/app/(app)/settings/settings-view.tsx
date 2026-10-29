"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertTriangle,
  Check,
  Eye,
  EyeOff,
  Globe2,
  Laptop,
  Link2,
  Lock,
  Monitor,
  ShieldCheck,
  Smartphone,
  Tablet,
  Unplug,
} from "lucide-react";
import { toast } from "sonner";
import {
  LIMITS,
  changeEmailSchema,
  changePasswordSchema,
} from "@linkhub/shared";
import { PageHeader } from "@/components/page-header";
import { DashboardFrame } from "@/components/dashboard-frame";
import { GoogleButton } from "@/components/auth/google-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldError, FieldHint, Input, Label } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatFieldErrors, useAppData } from "@/lib/store";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(value));
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5">
      <path
        fill="#4285F4"
        d="M21.6 12.227c0-.709-.064-1.39-.182-2.045H12v3.868h5.382a4.6 4.6 0 0 1-1.996 3.018v2.51h3.232c1.891-1.742 2.982-4.305 2.982-7.35Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.964-.895 6.618-2.423l-3.232-2.509c-.895.6-2.04.955-3.386.955-2.605 0-4.81-1.76-5.598-4.123H3.06v2.59A9.996 9.996 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.402 13.9a6.01 6.01 0 0 1 0-3.8V7.51H3.06a10.01 10.01 0 0 0 0 8.98l3.342-2.59Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.977c1.468 0 2.786.505 3.823 1.496l2.868-2.868C16.96 2.99 14.695 2 12 2a9.996 9.996 0 0 0-8.94 5.51l3.342 2.59C7.19 7.737 9.395 5.977 12 5.977Z"
      />
    </svg>
  );
}

function describeSession(userAgent: string): { label: string; icon: typeof Monitor } {
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /Chrome\//.test(userAgent)
      ? "Chrome"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Safari\//.test(userAgent)
          ? "Safari"
          : "Browser";
  if (/iPhone|iPad/.test(userAgent)) return { label: `${browser} on iOS`, icon: Smartphone };
  if (/Android/.test(userAgent)) return { label: `${browser} on Android`, icon: Smartphone };
  if (/Tablet/.test(userAgent)) return { label: `${browser} on tablet`, icon: Tablet };
  if (/Macintosh|Mac OS X/.test(userAgent)) return { label: `${browser} on macOS`, icon: Laptop };
  if (/Windows/.test(userAgent)) return { label: `${browser} on Windows`, icon: Monitor };
  if (/Linux/.test(userAgent)) return { label: `${browser} on Linux`, icon: Laptop };
  return { label: browser, icon: Monitor };
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  error,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  error?: string;
  hint?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          className="pr-10"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        />
        <button
          type="button"
          onClick={() => setShow((current) => !current)}
          className="absolute right-1 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-zinc-600 hover:bg-violet-50 hover:text-violet-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200"
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
        >
          {show ? (
            <EyeOff aria-hidden="true" className="size-4" />
          ) : (
            <Eye aria-hidden="true" className="size-4" />
          )}
        </button>
      </div>
      <FieldError>{error ? <span id={`${id}-error`}>{error}</span> : null}</FieldError>
      {hint ? (
        <FieldHint>
          <span id={`${id}-hint`}>{hint}</span>
        </FieldHint>
      ) : null}
    </div>
  );
}

export function SettingsView() {
  const {
    state,
    removeSession,
    removeOtherSessions,
    requestEmailChange,
    cancelPendingEmail,
    changePassword,
    restoreAccount,
    linkGoogle,
    unlinkGoogle,
  } = useAppData();

  const [email, setEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailErrors, setEmailErrors] = useState<{ email?: string; currentPassword?: string }>({});
  const [emailStatus, setEmailStatus] = useState("");
  const [googleBusy, setGoogleBusy] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordErrors, setPasswordErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  const pendingEmail = state.account.pendingEmail;
  const scheduledFor = state.account.deletionScheduledFor;
  const otherSessions = state.sessions.filter((session) => !session.current);
  const googleConnected = state.account.connectedProviders.includes("google");
  const googleEnabled = Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim());

  const connectGoogle = async (credential: string) => {
    setGoogleBusy(true);
    try {
      const result = await linkGoogle(credential);
      if (!result.ok) {
        const error = result.error;
        if (error?.status === 429) {
          toast.error("Too many attempts. Try again later.");
        } else {
          toast.error(error?.message ?? "Could not connect Google.");
        }
        return;
      }
      toast.success("Google account connected");
    } finally {
      setGoogleBusy(false);
    }
  };

  const disconnectGoogle = async () => {
    const ok = await unlinkGoogle();
    if (ok) toast.success("Google account disconnected");
  };

  const submitEmail = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = changeEmailSchema.safeParse({ email, currentPassword: emailPassword });
    const nextErrors: { email?: string; currentPassword?: string } = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as "email" | "currentPassword";
        if (!nextErrors[key]) nextErrors[key] = issue.message;
      }
    }
    if (email.trim().toLowerCase() === state.account.email.toLowerCase()) {
      nextErrors.email = "That is already your email.";
    }
    setEmailErrors(nextErrors);
    setEmailStatus("");
    if (Object.keys(nextErrors).length > 0) {
      document.getElementById(nextErrors.email ? "settings-email" : "settings-email-password")?.focus();
      return;
    }
    if (!parsed.success) return;

    const result = await requestEmailChange(parsed.data.email, parsed.data.currentPassword);
    if (!result.ok) {
      const error = result.error;
      const fieldErrors =
        error?.code === "VALIDATION_ERROR" ? formatFieldErrors(error.details) : {};
      if (error?.code === "INVALID_CREDENTIALS") {
        fieldErrors.currentPassword = error.message;
      }
      setEmailErrors(fieldErrors);
      if (Object.keys(fieldErrors).length > 0) {
        document
          .getElementById(
            fieldErrors.email ? "settings-email" : "settings-email-password",
          )
          ?.focus();
      } else {
        toast.error(error?.message ?? "Could not request an email change.");
      }
      return;
    }

    setEmail("");
    setEmailPassword("");
    setEmailStatus(
      `If that address is available, a verification link is on its way. Your email stays ${state.account.email} until you confirm the new address.`,
    );
    toast.success("Email change requested");
  };

  const submitPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = changePasswordSchema.safeParse({
      currentPassword,
      newPassword,
      confirmPassword,
    });
    const nextErrors: {
      currentPassword?: string;
      newPassword?: string;
      confirmPassword?: string;
    } = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as "currentPassword" | "newPassword" | "confirmPassword";
        if (!nextErrors[key]) nextErrors[key] = issue.message;
      }
    }
    if (newPassword && newPassword === currentPassword) {
      nextErrors.newPassword = "New password must differ from the current one.";
    }
    setPasswordErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      const id = nextErrors.currentPassword
        ? "settings-current-password"
        : nextErrors.newPassword
          ? "settings-new-password"
          : "settings-confirm-password";
      document.getElementById(id)?.focus();
      return;
    }
    if (!parsed.success) return;

    const result = await changePassword(parsed.data.currentPassword, parsed.data.newPassword);
    if (!result.ok) {
      const error = result.error;
      const fieldErrors =
        error?.code === "VALIDATION_ERROR" ? formatFieldErrors(error.details) : {};
      if (error?.code === "INVALID_CREDENTIALS") {
        fieldErrors.currentPassword = error.message;
      }
      setPasswordErrors(fieldErrors);
      if (fieldErrors.currentPassword) {
        document.getElementById("settings-current-password")?.focus();
      } else {
        toast.error(error?.message ?? "Could not update your password.");
      }
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    toast.success("Password updated. Other sessions signed out.");
  };

  const signOutSession = async (id: string, label: string) => {
    const ok = await removeSession(id);
    if (ok) toast.success(`Signed out ${label}`);
  };

  return (
    <DashboardFrame>
      <PageHeader
        title="Settings"
        description="Account, security and preferences. Profile and appearance live on their own pages."
      />

      {scheduledFor ? (
        <div
          role="status"
          className="mb-4 flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
        >
          <p className="flex items-start gap-2">
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>
              Your account is scheduled for deletion on <strong>{formatDate(scheduledFor)}</strong>.
              Signing in before then restores it.
            </span>
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              const ok = await restoreAccount();
              if (ok) toast.success("Account restored.");
            }}
          >
            Restore account
          </Button>
        </div>
      ) : null}

      <Tabs defaultValue="account">
        <TabsList aria-label="Settings sections">
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="notifications" disabled className="opacity-70">
            Notifications <Badge variant="later" className="hidden sm:inline-flex">LATER</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="max-w-3xl space-y-4">
          <Card className="p-5">
            <h2 className="font-bold text-zinc-900">Email address</h2>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-700">
              <span>
                Current: <strong>{state.account.email}</strong>
              </span>
              <Badge variant={state.account.emailVerified ? "green" : "amber"}>
                {state.account.emailVerified ? "Verified" : "Unverified"}
              </Badge>
            </p>

            {pendingEmail ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <p>
                  <strong>Verification pending:</strong> {pendingEmail}. Your email changes only
                  after you click the link we sent.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    const ok = await cancelPendingEmail();
                    if (ok) {
                      setEmailStatus("");
                      toast.success("Email change cancelled");
                    }
                  }}
                >
                  Cancel change
                </Button>
              </div>
            ) : null}

            <form
              onSubmit={(event) => {
                void submitEmail(event);
              }}
              noValidate
              className="mt-3 grid gap-3 sm:grid-cols-2"
            >
              <div>
                <Label htmlFor="settings-email">New email</Label>
                <Input
                  id="settings-email"
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setEmailErrors((current) => ({ ...current, email: undefined }));
                    setEmailStatus("");
                  }}
                  autoComplete="email"
                  aria-invalid={Boolean(emailErrors.email)}
                  aria-describedby={emailErrors.email ? "settings-email-error" : undefined}
                />
                <FieldError>
                  {emailErrors.email ? (
                    <span id="settings-email-error">{emailErrors.email}</span>
                  ) : null}
                </FieldError>
              </div>
              <PasswordField
                id="settings-email-password"
                label="Current password"
                value={emailPassword}
                onChange={(value) => {
                  setEmailPassword(value);
                  setEmailErrors((current) => ({ ...current, currentPassword: undefined }));
                }}
                autoComplete="current-password"
                error={emailErrors.currentPassword}
              />
              <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                <Button type="submit">Change email</Button>
                <p className="text-xs text-zinc-600">
                  We&apos;ll send a verification link to the new address. Your email changes only
                  after you click it.
                </p>
              </div>
            </form>

            {emailStatus ? (
              <p role="status" className="mt-2 flex items-start gap-1.5 text-sm text-green-800">
                <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                {emailStatus}
              </p>
            ) : null}
          </Card>

          {googleEnabled || googleConnected ? (
            <Card className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-800">
                    <Link2 aria-hidden="true" className="size-5" />
                  </span>
                  <div>
                    <h2 className="font-bold text-zinc-900">Connected accounts</h2>
                    <p className="mt-1 text-sm text-zinc-700">
                      Use Google to sign in to Link Hub. We store only Google&apos;s account
                      identifier, never your Google password or access tokens.
                    </p>
                  </div>
                </div>
                <Badge variant={googleConnected ? "green" : "zinc"}>
                  {googleConnected ? "Connected" : "Not connected"}
                </Badge>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-violet-100 bg-violet-50/50 p-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm">
                  <GoogleMark />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-zinc-900">Google</p>
                  <p className="text-xs text-zinc-600">
                    {googleConnected
                      ? "Linked to your Link Hub account."
                      : "Link your Google account for faster sign-in."}
                  </p>
                </div>
                {googleConnected ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!state.account.hasPassword}
                    onClick={() => {
                      void disconnectGoogle();
                    }}
                  >
                    <Unplug aria-hidden="true" className="size-4" />
                    Disconnect
                  </Button>
                ) : googleEnabled ? (
                  <div className="w-full sm:w-[260px]">
                    <GoogleButton
                      onCredential={connectGoogle}
                      disabled={googleBusy}
                      text="continue_with"
                    />
                  </div>
                ) : null}
              </div>
              {googleConnected && !state.account.hasPassword ? (
                <p className="mt-2 text-xs text-amber-800">
                  Set a password before disconnecting Google so you can still sign in.
                </p>
              ) : null}
            </Card>
          ) : null}

          <Card className="p-5">
            <h2 className="font-bold text-zinc-900">Change password</h2>
            <form
              onSubmit={(event) => {
                void submitPassword(event);
              }}
              noValidate
              className="mt-3 grid gap-3 sm:grid-cols-3"
            >
              <PasswordField
                id="settings-current-password"
                label="Current password"
                value={currentPassword}
                onChange={(value) => {
                  setCurrentPassword(value);
                  setPasswordErrors((current) => ({ ...current, currentPassword: undefined }));
                }}
                autoComplete="current-password"
                error={passwordErrors.currentPassword}
              />
              <PasswordField
                id="settings-new-password"
                label="New password"
                value={newPassword}
                onChange={(value) => {
                  setNewPassword(value);
                  setPasswordErrors((current) => ({ ...current, newPassword: undefined }));
                }}
                autoComplete="new-password"
                error={passwordErrors.newPassword}
              />
              <PasswordField
                id="settings-confirm-password"
                label="Confirm new password"
                value={confirmPassword}
                onChange={(value) => {
                  setConfirmPassword(value);
                  setPasswordErrors((current) => ({ ...current, confirmPassword: undefined }));
                }}
                autoComplete="new-password"
                error={passwordErrors.confirmPassword}
              />
              <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
                <Button type="submit">Update password</Button>
                <p className="text-xs text-zinc-600">
                  {LIMITS.minPassword}–{LIMITS.maxPassword} characters. Other sessions will be
                  signed out.
                </p>
              </div>
            </form>
          </Card>

          <Card className="p-5">
            <h2 className="font-bold text-zinc-900">Account</h2>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Plan</dt>
                <dd className="mt-0.5 font-semibold text-zinc-900">Free</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Member since
                </dt>
                <dd className="mt-0.5 font-semibold text-zinc-900">
                  {formatDate(state.account.createdAt)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Links used
                </dt>
                <dd className="mt-0.5 font-semibold text-zinc-900">
                  {state.links.length} / {LIMITS.maxLinks}
                </dd>
              </div>
            </dl>
            <p className="mt-4 text-sm text-zinc-700">
              Account deletion is managed on your{" "}
              <Link href="/dashboard/profile" className="font-semibold text-violet-800 underline">
                Profile page
              </Link>{" "}
              so you can export your data first.
            </p>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="max-w-3xl">
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-zinc-900">Active sessions</h2>
                <p className="text-sm text-zinc-700">Devices currently signed in to your account.</p>
              </div>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={otherSessions.length === 0}
                onClick={async () => {
                  const ok = await removeOtherSessions();
                  if (ok) toast.success("Signed out of all other sessions");
                }}
              >
                Sign out everywhere else
              </Button>
            </div>

            <ul className="mt-3 divide-y divide-violet-50">
              {state.sessions.map((session) => {
                const { label, icon: Icon } = describeSession(session.userAgent);
                return (
                  <li key={session.id} className="flex flex-wrap items-center gap-3 py-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-800">
                      <Icon aria-hidden="true" className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-zinc-900">
                        {label}
                        {session.current ? <Badge variant="green">This device</Badge> : null}
                      </p>
                      <p className="text-xs text-zinc-600">
                        Last active {formatDateTime(session.lastSeenAt)} · signed in{" "}
                        {formatDate(session.createdAt)}
                      </p>
                    </div>
                    {session.current ? (
                      <span className="text-xs font-semibold text-green-800">Active now</span>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          void signOutSession(session.id, label);
                        }}
                        aria-label={`Sign out ${label}`}
                      >
                        Sign out
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>

            <p className="mt-3 flex items-start gap-2 rounded-xl bg-violet-50 p-3 text-xs text-violet-950">
              <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              Sessions expire after {LIMITS.sessionDays} days. Changing your password signs out every
              other session.
            </p>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="max-w-3xl space-y-4">
          <Card className="p-5">
            <h2 className="font-bold text-zinc-900">Analytics timezone</h2>
            <div className="mt-3 max-w-sm">
              <Label htmlFor="settings-timezone">Timezone</Label>
              <div className="relative">
                <Input
                  id="settings-timezone"
                  value="UTC (Coordinated Universal Time)"
                  readOnly
                  className="bg-zinc-50 pr-10"
                  aria-describedby="settings-timezone-hint"
                />
                <Lock
                  aria-hidden="true"
                  className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500"
                />
              </div>
              <FieldHint>
                <span id="settings-timezone-hint">
                  Analytics days are recorded and displayed in UTC. Timezone-aware reporting is
                  planned.
                </span>
              </FieldHint>
            </div>
            <p className="mt-4 flex items-start gap-2 rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm text-violet-950">
              <Globe2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              Keeping analytics in UTC makes daily totals consistent across regions and DST
              changes.
            </p>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="flex flex-col p-5">
              <h2 className="font-bold text-zinc-900">Public profile</h2>
              <p className="mt-1 flex-1 text-sm text-zinc-700">
                Update your name, headline, bio, avatar URL and social links.
              </p>
              <Button asChild variant="secondary" className="mt-4 self-start">
                <Link href="/dashboard/profile">Edit profile</Link>
              </Button>
            </Card>
            <Card className="flex flex-col p-5">
              <h2 className="font-bold text-zinc-900">Appearance</h2>
              <p className="mt-1 flex-1 text-sm text-zinc-700">
                Choose a theme, colors, backgrounds and button styles.
              </p>
              <Button asChild variant="secondary" className="mt-4 self-start">
                <Link href="/dashboard/appearance">Edit appearance</Link>
              </Button>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="notifications" className="max-w-3xl">
          <Card className="p-5 opacity-80">
            <h2 className="flex items-center gap-2 font-bold text-zinc-900">
              Notifications <Badge variant="later">LATER</Badge>
            </h2>
            <p className="mt-1 text-sm text-zinc-700">
              Email digests and click milestones are coming soon. Nothing to configure yet.
            </p>
            <ul className="mt-4 space-y-3 text-sm">
              {["Weekly analytics digest", "Milestone alerts", "Product updates"].map((label) => (
                <li key={label} className="flex items-center justify-between gap-4">
                  <span id={`notification-${label.replace(/\s+/g, "-").toLowerCase()}`}>
                    {label}
                  </span>
                  <Switch
                    checked={false}
                    disabled
                    aria-labelledby={`notification-${label.replace(/\s+/g, "-").toLowerCase()}`}
                  />
                </li>
              ))}
            </ul>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardFrame>
  );
}
