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
  Lock,
  Monitor,
  ShieldCheck,
  Smartphone,
  Tablet,
} from "lucide-react";
import { toast } from "sonner";
import {
  LIMITS,
  changeEmailSchema,
  changePasswordSchema,
} from "@linkhub/shared";
import { PageHeader } from "@/components/page-header";
import { DashboardFrame } from "@/components/dashboard-frame";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldError, FieldHint, Input, Label } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMockData } from "@/lib/store";

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
    setPendingEmail,
    cancelPendingEmail,
    restoreAccount,
  } = useMockData();

  const [email, setEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailErrors, setEmailErrors] = useState<{ email?: string; currentPassword?: string }>({});
  const [emailStatus, setEmailStatus] = useState("");

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

  const submitEmail = (event: React.FormEvent<HTMLFormElement>) => {
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
    if (emailPassword === "wrong") {
      nextErrors.currentPassword = "Incorrect password.";
    }
    setEmailErrors(nextErrors);
    setEmailStatus("");
    if (Object.keys(nextErrors).length > 0) {
      document.getElementById(nextErrors.email ? "settings-email" : "settings-email-password")?.focus();
      return;
    }

    setPendingEmail(parsed.success ? parsed.data.email : email.trim());
    setEmail("");
    setEmailPassword("");
    setEmailStatus(
      `Verification link sent. Your email stays ${state.account.email} until you confirm the new address.`,
    );
    toast.success("Verification link sent");
  };

  const submitPassword = (event: React.FormEvent<HTMLFormElement>) => {
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
    if (currentPassword === "wrong") {
      nextErrors.currentPassword = "Incorrect password.";
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

    removeOtherSessions();
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    toast.success("Password updated. Other sessions signed out.");
  };

  const signOutSession = (id: string, label: string) => {
    removeSession(id);
    toast.success(`Signed out ${label}`);
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
            onClick={() => {
              restoreAccount();
              toast.success("Account restored.");
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
                  onClick={() => {
                    cancelPendingEmail();
                    setEmailStatus("");
                    toast.success("Email change cancelled");
                  }}
                >
                  Cancel change
                </Button>
              </div>
            ) : null}

            <form onSubmit={submitEmail} noValidate className="mt-3 grid gap-3 sm:grid-cols-2">
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

          <Card className="p-5">
            <h2 className="font-bold text-zinc-900">Change password</h2>
            <form onSubmit={submitPassword} noValidate className="mt-3 grid gap-3 sm:grid-cols-3">
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
                onClick={() => {
                  removeOtherSessions();
                  toast.success("Signed out of all other sessions");
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
                        onClick={() => signOutSession(session.id, label)}
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
