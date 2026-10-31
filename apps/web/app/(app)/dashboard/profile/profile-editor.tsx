"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Globe2,
  Mail,
  Save,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { Profile, ProfileInput, SocialKey } from "@linkhub/shared";
import { LIMITS, profileSchema, usernameSchema } from "@linkhub/shared";
import { Avatar } from "@/components/avatar";
import { BrandIcon, isBrandName } from "@/components/brand-icons";
import { DashboardFrame } from "@/components/dashboard-frame";
import { DashboardPreview } from "@/components/dashboard-preview";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldError, FieldHint, Input, Label, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api-client";
import { formatFieldErrors, useAppData } from "@/lib/store";
import { usePendingAction } from "@/lib/use-pending-action";
import { cn } from "@/lib/utils";

const PUBLIC_ORIGIN = (
  process.env.NEXT_PUBLIC_APP_URL ?? "https://link.nayankunwar.com"
).replace(/\/$/, "");

const SOCIAL_FIELDS: Array<{
  key: SocialKey;
  label: string;
  placeholder: string;
  hint?: string;
}> = [
  { key: "website", label: "Website URL", placeholder: "https://your-site.com" },
  { key: "github", label: "GitHub URL", placeholder: "https://github.com/you" },
  { key: "linkedin", label: "LinkedIn URL", placeholder: "https://www.linkedin.com/in/you" },
  { key: "x", label: "X URL", placeholder: "https://x.com/you" },
  { key: "medium", label: "Medium URL", placeholder: "https://medium.com/@you" },
  {
    key: "email",
    label: "Email link",
    placeholder: "mailto:you@example.com",
    hint: "Use a mailto: link so visitors can email you.",
  },
];

function toInput(profile: Profile): ProfileInput {
  return {
    displayName: profile.displayName,
    headline: profile.headline,
    username: profile.username,
    bio: profile.bio,
    avatarUrl: profile.avatarUrl,
    socials: { ...profile.socials },
    isPublished: profile.isPublished,
  };
}

function socialIcon(key: SocialKey) {
  if (isBrandName(key)) return <BrandIcon name={key} className="size-5" />;
  if (key === "email") return <Mail aria-hidden="true" className="size-5 text-violet-700" />;
  return <Globe2 aria-hidden="true" className="size-5 text-violet-700" />;
}

function formatDeletionDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function ProfileEditor() {
  const { state, hydrated, updateProfile, setPublished, scheduleDeletion, restoreAccount } =
    useAppData();
  const { pending, run } = usePendingAction();
  const [draft, setDraft] = useState<ProfileInput>(() => toInput(state.profile));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [availability, setAvailability] = useState<
    "idle" | "checking" | "available" | "taken" | "reserved"
  >("idle");
  const [origin, setOrigin] = useState(PUBLIC_ORIGIN);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteErrors, setDeleteErrors] = useState<{ password?: string; confirm?: string }>({});
  const [showPassword, setShowPassword] = useState(false);
  const synced = useRef(false);

  useEffect(() => {
    if (!hydrated || synced.current) return;
    setDraft(toInput(state.profile));
    synced.current = true;
  }, [hydrated, state.profile]);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const dirty = JSON.stringify(draft) !== JSON.stringify(toInput(state.profile));

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    if (draft.username === state.profile.username) {
      setAvailability("idle");
      return;
    }
    const parsed = usernameSchema.safeParse(draft.username);
    if (!parsed.success) {
      setAvailability("idle");
      return;
    }
    setAvailability("checking");
    let cancelled = false;
    const timer = window.setTimeout(() => {
      api.usernames
        .availability(parsed.data)
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
    }, 450);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [draft.username, state.profile.username]);

  const update = <Key extends keyof ProfileInput>(key: Key, value: ProfileInput[Key]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key as string]) return current;
      const next = { ...current };
      delete next[key as string];
      return next;
    });
  };

  const updateSocial = (key: SocialKey, value: string) => {
    setDraft((current) => ({ ...current, socials: { ...current.socials, [key]: value } }));
    setErrors((current) => {
      const field = `socials.${key}`;
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const focusError = (first: string) => {
    const id =
      first === "displayName"
        ? "profile-display-name"
        : first === "headline"
          ? "profile-headline"
          : first === "username"
            ? "profile-username"
            : first === "bio"
              ? "profile-bio"
              : first === "avatarUrl"
                ? "profile-avatar"
                : `social-${first.split(".")[1]}`;
    document.getElementById(id)?.focus();
  };

  const save = async () => {
    const parsed = profileSchema.safeParse(draft);
    const nextErrors: Record<string, string> = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".");
        if (!nextErrors[key]) nextErrors[key] = issue.message;
      }
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      focusError(Object.keys(nextErrors)[0]);
      toast.error("Check the highlighted fields.");
      return;
    }
    if (!parsed.success) return;

    const usernameChanged = parsed.data.username !== state.profile.username;
    if (usernameChanged) {
      try {
        const result = await api.usernames.availability(parsed.data.username);
        if (!result.available) {
          const message =
            result.reason === "reserved"
              ? "That username is reserved."
              : "That username is already taken.";
          setErrors({ username: message });
          setAvailability(result.reason === "reserved" ? "reserved" : "taken");
          document.getElementById("profile-username")?.focus();
          return;
        }
        setAvailability("available");
      } catch {
        toast.error("Could not check username availability. Try again.");
        return;
      }
    }

    const result = await updateProfile(parsed.data);
    if (!result.ok) {
      const error = result.error;
      const fieldErrors =
        error?.code === "VALIDATION_ERROR" ? formatFieldErrors(error.details) : {};
      if (error?.code === "USERNAME_TAKEN" || error?.code === "USERNAME_RESERVED") {
        fieldErrors.username = error.message;
      }
      setErrors(fieldErrors);
      if (Object.keys(fieldErrors).length > 0) {
        focusError(Object.keys(fieldErrors)[0]);
      }
      toast.error(error?.message ?? "Could not save your profile.");
      return;
    }

    setDraft(parsed.data);
    setErrors({});
    toast.success("Profile saved");
  };

  const togglePublished = async (checked: boolean) => {
    const ok = await setPublished(checked);
    if (!ok) return;
    setDraft((current) => ({ ...current, isPublished: checked }));
    toast.success(checked ? "Profile published" : "Profile unpublished");
  };

  const publicUrl = `${origin}/${state.profile.username}`;

  const copyPublicUrl = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy. Select the URL and copy it manually.");
    }
  };

  const openDelete = () => {
    setDeletePassword("");
    setDeleteConfirm("");
    setDeleteErrors({});
    setShowPassword(false);
    setDeleteOpen(true);
  };

  const confirmDelete = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: { password?: string; confirm?: string } = {};
    if (!deletePassword) {
      nextErrors.password = "Enter your password.";
    }
    if (deleteConfirm !== state.profile.username) {
      nextErrors.confirm = "Username does not match.";
    }
    setDeleteErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      document.getElementById(nextErrors.password ? "delete-password" : "delete-confirm")?.focus();
      return;
    }

    const result = await scheduleDeletion(deletePassword, deleteConfirm);
    if (!result.ok) {
      const error = result.error;
      if (error?.code === "INVALID_CREDENTIALS") {
        setDeleteErrors({ password: error.message });
        document.getElementById("delete-password")?.focus();
      } else if (error?.code === "VALIDATION_ERROR") {
        const fields = formatFieldErrors(error.details);
        setDeleteErrors({ confirm: fields.confirmUsername ?? error.message });
        document.getElementById("delete-confirm")?.focus();
      } else {
        toast.error(error?.message ?? "Could not schedule account deletion.");
      }
      return;
    }

    setDeleteOpen(false);
    toast.success(
      `Account scheduled for deletion. You have ${LIMITS.deleteGraceDays} days to restore it.`,
    );
  };

  const scheduledFor = state.account.deletionScheduledFor;
  const previewProfile: Profile = {
    ...state.profile,
    ...draft,
    socials: draft.socials,
  };

  return (
    <DashboardFrame preview={<DashboardPreview title="Public profile preview" profileOverride={previewProfile} />}>
      <PageHeader
        title="Profile"
        description="Your public identity: how people see you on link.nayankunwar.com."
        actions={
          <>
            <span
              role="status"
              aria-live="polite"
              className={cn(
                "hidden text-sm sm:inline",
                dirty ? "font-semibold text-amber-800" : "text-zinc-700",
              )}
            >
              {dirty ? "● Unsaved changes" : "Saved"}
            </span>
            <Button
              onClick={() => {
                void run("save", save);
              }}
              disabled={!dirty || pending !== null}
              loading={pending === "save"}
            >
              <Save aria-hidden="true" className="size-4" />
              Save profile
            </Button>
          </>
        }
      />

      {scheduledFor ? (
        <div
          role="status"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
        >
          <p className="flex items-start gap-2">
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>
              Your account is scheduled for deletion on{" "}
              <strong>{formatDeletionDate(scheduledFor)}</strong>. Signing in before then restores
              it.
            </span>
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              void run("restore", async () => {
                const ok = await restoreAccount();
                if (ok) {
                  toast.success("Account restored. Publish your profile when you're ready.");
                }
              });
            }}
            disabled={pending !== null}
            loading={pending === "restore"}
          >
            Restore account
          </Button>
        </div>
      ) : null}

      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void run("save", save);
        }}
        className="grid grid-cols-1 gap-4 xl:grid-cols-2"
      >
        <Card className="space-y-4 p-5">
          <h2 className="font-bold text-zinc-900">Basic information</h2>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <Avatar
              name={draft.displayName || "Link Hub"}
              src={draft.avatarUrl}
              className="size-20 text-2xl ring-violet-100"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="profile-avatar">Avatar URL</Label>
                {draft.avatarUrl ? (
                  <button
                    type="button"
                    onClick={() => update("avatarUrl", "")}
                    className="mb-1.5 inline-flex items-center gap-1 text-xs font-semibold text-zinc-600 hover:text-red-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200"
                  >
                    <X aria-hidden="true" className="size-3" /> Remove
                  </button>
                ) : null}
              </div>
              <Input
                id="profile-avatar"
                type="url"
                value={draft.avatarUrl}
                onChange={(event) => update("avatarUrl", event.target.value)}
                placeholder="https://example.com/avatar.jpg"
                aria-invalid={Boolean(errors.avatarUrl)}
                aria-describedby={errors.avatarUrl ? "profile-avatar-error" : "profile-avatar-hint"}
              />
              <FieldError>
                {errors.avatarUrl ? <span id="profile-avatar-error">{errors.avatarUrl}</span> : null}
              </FieldError>
              <FieldHint>
                <span id="profile-avatar-hint">
                  Paste an https:// image URL. Leave blank to use your initials.
                </span>
              </FieldHint>
            </div>
          </div>

          <div>
            <Label htmlFor="profile-display-name">Display name</Label>
            <Input
              id="profile-display-name"
              value={draft.displayName}
              onChange={(event) => update("displayName", event.target.value)}
              maxLength={LIMITS.maxDisplayName}
              autoComplete="name"
              aria-invalid={Boolean(errors.displayName)}
              aria-describedby={errors.displayName ? "profile-display-name-error" : undefined}
            />
            <FieldError>
              {errors.displayName ? (
                <span id="profile-display-name-error">{errors.displayName}</span>
              ) : null}
            </FieldError>
          </div>

          <div>
            <div className="flex items-end justify-between">
              <Label htmlFor="profile-headline">Headline</Label>
              <span className="mb-1.5 text-xs text-zinc-500">
                {draft.headline.length} / {LIMITS.maxHeadline}
              </span>
            </div>
            <Input
              id="profile-headline"
              value={draft.headline}
              onChange={(event) => update("headline", event.target.value)}
              maxLength={LIMITS.maxHeadline}
              placeholder="Backend Engineer"
              aria-invalid={Boolean(errors.headline)}
              aria-describedby={errors.headline ? "profile-headline-error" : undefined}
            />
            <FieldError>
              {errors.headline ? <span id="profile-headline-error">{errors.headline}</span> : null}
            </FieldError>
          </div>

          <div>
            <Label htmlFor="profile-username">Username</Label>
            <div className="flex">
              <span className="inline-flex shrink-0 items-center rounded-l-lg border border-r-0 border-zinc-300 bg-zinc-50 px-3 text-xs text-zinc-700 sm:text-sm">
                link.nayankunwar.com/
              </span>
              <Input
                id="profile-username"
                value={draft.username}
                onChange={(event) =>
                  update("username", event.target.value.replace(/\s/g, "").toLowerCase())
                }
                maxLength={30}
                autoComplete="off"
                spellCheck={false}
                className="rounded-l-none"
                aria-invalid={Boolean(errors.username) || availability === "taken"}
                aria-describedby="profile-username-hint profile-username-status profile-username-error"
              />
            </div>
            <FieldHint>
              <span id="profile-username-hint">
                3–30 characters: lowercase letters, numbers, hyphens
              </span>
            </FieldHint>
            <p id="profile-username-status" aria-live="polite" className="mt-1 text-xs">
              {availability === "checking" ? (
                <span className="text-zinc-600">Checking availability…</span>
              ) : availability === "available" ? (
                <span className="inline-flex items-center gap-1 font-semibold text-green-800">
                  <Check aria-hidden="true" className="size-3.5" /> Available
                </span>
              ) : availability === "taken" ? (
                <span className="inline-flex items-center gap-1 font-semibold text-red-700">
                  <X aria-hidden="true" className="size-3.5" /> Already taken
                </span>
              ) : availability === "reserved" ? (
                <span className="inline-flex items-center gap-1 font-semibold text-red-700">
                  <X aria-hidden="true" className="size-3.5" /> Reserved
                </span>
              ) : draft.username === state.profile.username ? (
                <span className="text-zinc-600">This is your current username.</span>
              ) : null}
            </p>
            <FieldError>
              {errors.username ? <span id="profile-username-error">{errors.username}</span> : null}
            </FieldError>
          </div>

          <div>
            <div className="flex items-end justify-between">
              <Label htmlFor="profile-bio">Bio</Label>
              <span
                className={cn(
                  "mb-1.5 text-xs",
                  draft.bio.length > LIMITS.maxBio - 10
                    ? "font-semibold text-amber-800"
                    : "text-zinc-500",
                )}
                aria-live="polite"
              >
                {draft.bio.length} / {LIMITS.maxBio}
              </span>
            </div>
            <Textarea
              id="profile-bio"
              value={draft.bio}
              onChange={(event) => update("bio", event.target.value)}
              maxLength={LIMITS.maxBio}
              rows={3}
              aria-invalid={Boolean(errors.bio)}
              aria-describedby={errors.bio ? "profile-bio-error" : undefined}
            />
            <FieldError>
              {errors.bio ? <span id="profile-bio-error">{errors.bio}</span> : null}
            </FieldError>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="space-y-3 p-5">
            <div>
              <h2 className="font-bold text-zinc-900">Social links</h2>
              <p className="text-sm text-zinc-700">Shown as icons under your bio.</p>
            </div>

            {SOCIAL_FIELDS.map((field) => {
              const fieldKey = `socials.${field.key}`;
              const fieldId = `social-${field.key}`;
              return (
                <div key={field.key} className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50">
                    {socialIcon(field.key)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Label htmlFor={fieldId} className="sr-only">
                      {field.label}
                    </Label>
                    <Input
                      id={fieldId}
                      type="url"
                      value={draft.socials[field.key]}
                      onChange={(event) => updateSocial(field.key, event.target.value)}
                      placeholder={field.placeholder}
                      aria-invalid={Boolean(errors[fieldKey])}
                      aria-describedby={
                        errors[fieldKey]
                          ? `${fieldId}-error`
                          : field.hint
                            ? `${fieldId}-hint`
                            : undefined
                      }
                    />
                    <FieldError>
                      {errors[fieldKey] ? (
                        <span id={`${fieldId}-error`}>{errors[fieldKey]}</span>
                      ) : null}
                    </FieldError>
                    {field.hint ? (
                      <FieldHint>
                        <span id={`${fieldId}-hint`}>{field.hint}</span>
                      </FieldHint>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </Card>

          <Card className="p-5">
            <h2 className="mb-2 font-bold text-zinc-900">Public profile</h2>
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="public-url" className="sr-only">
                Public URL
              </Label>
              <Input
                id="public-url"
                readOnly
                value={publicUrl}
                className="min-w-0 flex-1 bg-zinc-50"
                onFocus={(event) => event.currentTarget.select()}
              />
              <Button type="button" variant="secondary" onClick={copyPublicUrl}>
                <Copy aria-hidden="true" className="size-4" /> Copy
              </Button>
              <Button asChild variant="secondary">
                <Link
                  href={`/${state.profile.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink aria-hidden="true" className="size-4" /> Open
                </Link>
              </Button>
            </div>

            <div className="mt-4 flex items-center justify-between gap-4">
              <div>
                <p id="published-label" className="text-sm font-semibold text-zinc-900">
                  {state.profile.isPublished ? "Published" : "Unpublished"}
                </p>
                <p id="published-description" className="text-xs text-zinc-600">
                  {state.profile.isPublished
                    ? "Anyone with the link can see your profile."
                    : "Your profile is hidden; visitors see “not found”."}
                </p>
              </div>
              <Switch
                checked={state.profile.isPublished}
                onCheckedChange={(checked) => {
                  void run("publish", () => togglePublished(checked));
                }}
                disabled={pending !== null}
                aria-labelledby="published-label"
                aria-describedby="published-description"
              />
            </div>
          </Card>

          <Card className="border-red-200 p-5">
            <h2 className="font-bold text-red-800">Danger zone</h2>
            {scheduledFor ? (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-zinc-700">
                  Deletion is scheduled for {formatDeletionDate(scheduledFor)}. Restore your
                  account to cancel it.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    void run("restore", async () => {
                      const ok = await restoreAccount();
                      if (ok) toast.success("Account restored.");
                    });
                  }}
                  disabled={pending !== null}
                  loading={pending === "restore"}
                >
                  Restore account
                </Button>
              </div>
            ) : (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
                <p className="text-sm text-zinc-700">
                  Delete your account, profile, links and analytics. You&apos;ll have{" "}
                  {LIMITS.deleteGraceDays} days to change your mind.
                </p>
                <Button type="button" variant="destructive" onClick={openDelete}>
                  Delete account
                </Button>
              </div>
            )}
          </Card>
        </div>
      </form>

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (pending === "delete") return;
          setDeleteOpen(open);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-800">Delete your account?</DialogTitle>
            <DialogDescription>
              Your profile goes offline immediately. Everything is permanently deleted after a{" "}
              <strong>{LIMITS.deleteGraceDays}-day grace period</strong>; sign in before then to
              cancel. Consider{" "}
              <Link href="/dashboard/export" className="font-semibold text-violet-800 underline">
                exporting your data
              </Link>{" "}
              first.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void run("delete", () => confirmDelete(event));
            }}
            noValidate
          >
            <div className="mb-3">
              <Label htmlFor="delete-password">Current password</Label>
              <div className="relative">
                <Input
                  id="delete-password"
                  type={showPassword ? "text" : "password"}
                  value={deletePassword}
                  onChange={(event) => {
                    setDeletePassword(event.target.value);
                    setDeleteErrors((current) => ({ ...current, password: undefined }));
                  }}
                  autoComplete="current-password"
                  className="pr-10"
                  aria-invalid={Boolean(deleteErrors.password)}
                  aria-describedby={deleteErrors.password ? "delete-password-error" : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-1 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-zinc-600 hover:bg-violet-50 hover:text-violet-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? (
                    <EyeOff aria-hidden="true" className="size-4" />
                  ) : (
                    <Eye aria-hidden="true" className="size-4" />
                  )}
                </button>
              </div>
              <FieldError>
                {deleteErrors.password ? (
                  <span id="delete-password-error">{deleteErrors.password}</span>
                ) : null}
              </FieldError>
            </div>

            <div className="mb-1">
              <Label htmlFor="delete-confirm">
                Type <span className="font-mono">{state.profile.username}</span> to confirm
              </Label>
              <Input
                id="delete-confirm"
                value={deleteConfirm}
                onChange={(event) => {
                  setDeleteConfirm(event.target.value);
                  setDeleteErrors((current) => ({ ...current, confirm: undefined }));
                }}
                autoComplete="off"
                aria-invalid={Boolean(deleteErrors.confirm)}
                aria-describedby={deleteErrors.confirm ? "delete-confirm-error" : undefined}
              />
              <FieldError>
                {deleteErrors.confirm ? (
                  <span id="delete-confirm-error">{deleteErrors.confirm}</span>
                ) : null}
              </FieldError>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDeleteOpen(false)}
                disabled={pending === "delete"}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="danger"
                loading={pending === "delete"}
                disabled={pending !== null && pending !== "delete"}
              >
                Delete account
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardFrame>
  );
}
