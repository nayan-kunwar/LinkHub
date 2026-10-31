"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Heading,
  Link2,
  Phone,
  MonitorPlay,
  type LucideIcon,
} from "lucide-react";
import type {
  Category,
  Link as LinkRecord,
  LinkFormValues,
  LinkIconId,
  LinkLayout,
  LinkType,
} from "@linkhub/shared";
import {
  defaultConfigFor,
  LIMITS,
  linkFormSchema,
  LINK_ICON_IDS,
  parseYouTubeId,
} from "@linkhub/shared";
import { LinkIcon } from "@/components/link-icon";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input, Label, FieldError, FieldHint, Select, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const ICON_LABELS: Record<LinkIconId, string> = {
  auto: "Auto-detect",
  link: "Link",
  globe: "Globe",
  mail: "Email",
  file: "File",
  code: "Code",
  share: "Share",
  briefcase: "Briefcase",
  book: "Book",
  star: "Star",
  heart: "Heart",
  archive: "Archive",
  github: "GitHub",
  linkedin: "LinkedIn",
  x: "X",
  medium: "Medium",
  youtube: "YouTube",
  spotify: "Spotify",
  instagram: "Instagram",
};

const TYPE_OPTIONS: Array<{
  type: LinkType;
  label: string;
  blurb: string;
  icon: LucideIcon;
}> = [
  {
    type: "link",
    label: "Link",
    blurb: "A button, rich card or featured image",
    icon: Link2,
  },
  {
    type: "header",
    label: "Header",
    blurb: "A section title for your page",
    icon: Heading,
  },
  {
    type: "youtube",
    label: "YouTube",
    blurb: "Embed a video with a click-to-play cover",
    icon: MonitorPlay,
  },
  {
    type: "contact",
    label: "Contact",
    blurb: "Email, phone and WhatsApp buttons",
    icon: Phone,
  },
];

const TYPE_LABELS: Record<LinkType, string> = {
  link: "Link",
  header: "Header",
  youtube: "YouTube",
  contact: "Contact",
};

const LAYOUT_OPTIONS: Array<{
  value: LinkLayout;
  label: string;
  blurb: string;
}> = [
  { value: "classic", label: "Classic", blurb: "Icon and title" },
  { value: "rich", label: "Rich", blurb: "Thumbnail and subtitle" },
  { value: "featured", label: "Featured", blurb: "Large image card" },
];

interface LinkDraft {
  type: LinkType;
  title: string;
  url: string;
  categoryId: string | null;
  description: string;
  icon: LinkIconId;
  isActive: boolean;
  config: Record<string, unknown>;
}

function emptyValues(type: LinkType): LinkDraft {
  const config = defaultConfigFor(type);
  if (type === "youtube") config.videoId = "";
  return {
    type,
    title: "",
    url: "",
    categoryId: null,
    description: "",
    icon: "auto",
    isActive: true,
    config,
  };
}

function valuesFromLink(link: LinkRecord): LinkDraft {
  const config = { ...defaultConfigFor(link.type), ...link.config };
  if (link.type === "youtube" && typeof config.videoId !== "string") {
    config.videoId = parseYouTubeId(link.url) ?? "";
  }
  return {
    type: link.type,
    title: link.title,
    url: link.url,
    categoryId: link.categoryId,
    description: link.description,
    icon: link.icon,
    isActive: link.isActive,
    config,
  };
}

function configString(config: Record<string, unknown>, key: string): string {
  const value = config[key];
  return typeof value === "string" ? value : "";
}

export function LinkDialog({
  open,
  onOpenChange,
  link,
  categories,
  linkCount,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  link: LinkRecord | null;
  categories: Category[];
  linkCount: number;
  onSubmit: (values: LinkFormValues) => Promise<void> | void;
}) {
  const [step, setStep] = useState<"type" | "form">(link ? "form" : "type");
  const [draft, setDraft] = useState<LinkDraft>(() =>
    link ? valuesFromLink(link) : emptyValues("link"),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [limitError, setLimitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const limitReached = !link && linkCount >= LIMITS.maxLinks;
  const isEditing = Boolean(link);
  const type = draft.type;

  useEffect(() => {
    if (!open) return;
    setDraft(link ? valuesFromLink(link) : emptyValues("link"));
    setStep(link ? "form" : "type");
    setErrors({});
    setLimitError("");
  }, [open, link]);

  const update = <Key extends keyof LinkDraft>(key: Key, value: LinkDraft[Key]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key as string];
      return next;
    });
    setLimitError("");
  };

  const updateConfig = (key: string, value: string) => {
    setDraft((current) => ({
      ...current,
      config: { ...current.config, [key]: value },
    }));
    setErrors((current) => {
      const next = { ...current };
      delete next[`config.${key}`];
      delete next.config;
      return next;
    });
    setLimitError("");
  };

  const pickType = (nextType: LinkType) => {
    setDraft(emptyValues(nextType));
    setErrors({});
    setStep("form");
  };

  const updateUrl = (value: string) => {
    setDraft((current) => {
      if (current.type !== "youtube") return { ...current, url: value };
      return {
        ...current,
        url: value,
        config: { ...current.config, videoId: parseYouTubeId(value) ?? "" },
      };
    });
    setErrors((current) => {
      const next = { ...current };
      delete next.url;
      delete next["config.videoId"];
      return next;
    });
    setLimitError("");
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    if (limitReached) {
      setLimitError(`The free plan supports up to ${LIMITS.maxLinks} links.`);
      return;
    }
    const parsed = linkFormSchema.safeParse(draft);
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.length > 0 ? issue.path.join(".") : "config";
        if (!nextErrors[key]) nextErrors[key] = issue.message;
      }
      setErrors(nextErrors);
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(parsed.data);
    } finally {
      setSubmitting(false);
    }
  };

  const iconPreview = useMemo(
    () => (
      <LinkIcon
        icon={draft.icon}
        url={draft.url || "https://example.com"}
        className="size-5"
      />
    ),
    [draft.icon, draft.url],
  );

  const youtubeId = type === "youtube" ? parseYouTubeId(draft.url) : null;
  const imageUrl = configString(draft.config, "imageUrl");
  const layout = (configString(draft.config, "layout") || "classic") as LinkLayout;

  const titleLabel = type === "header" || type === "contact" ? "Heading" : "Title";
  const titlePlaceholder =
    type === "header"
      ? "Work links"
      : type === "contact"
        ? "Contact me"
        : type === "youtube"
          ? "Watch the latest video"
          : "My portfolio";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (submitting) return;
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? `Edit ${TYPE_LABELS[type].toLowerCase()} block` : "Add block"}
          </DialogTitle>
          <DialogDescription>
            {step === "type"
              ? "Pick what you want to add to your profile."
              : isEditing
                ? "Update how this block appears on your public profile. Its type can't be changed."
                : "Fill in the details for this block."}
          </DialogDescription>
        </DialogHeader>

        {step === "type" ? (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {TYPE_OPTIONS.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.type}
                  type="button"
                  onClick={() => pickType(option.type)}
                  className="group flex items-start gap-3 rounded-xl border-2 border-zinc-200 bg-white p-3 text-left transition hover:border-violet-400 hover:bg-violet-50/60 focus-visible:ring-4 focus-visible:ring-violet-200"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-800">
                    <Icon aria-hidden="true" className="size-4.5" />
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-zinc-900">{option.label}</span>
                    <span className="mt-0.5 block text-xs leading-snug text-zinc-600">
                      {option.blurb}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            {isEditing ? (
              <p className="mb-4 inline-flex rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-800">
                {TYPE_LABELS[type]} block
              </p>
            ) : null}

            {limitReached || limitError ? (
              <div
                role="alert"
                className="mb-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>
                  {limitReached
                    ? `You've reached the ${LIMITS.maxLinks}-link limit on the free plan. Delete a link before adding another.`
                    : limitError}
                </span>
              </div>
            ) : null}

            <div className="mb-3.5">
              <Label htmlFor="link-title">{titleLabel}</Label>
              <Input
                id="link-title"
                value={draft.title}
                onChange={(event) => update("title", event.target.value)}
                placeholder={titlePlaceholder}
                maxLength={LIMITS.maxLinkTitle}
                aria-invalid={Boolean(errors.title)}
                aria-describedby={errors.title ? "link-title-error" : undefined}
                autoFocus
              />
              <FieldError>
                {errors.title ? <span id="link-title-error">{errors.title}</span> : null}
              </FieldError>
            </div>

            {type === "link" || type === "youtube" ? (
              <div className="mb-3.5">
                <Label htmlFor="link-url">
                  {type === "youtube" ? "YouTube URL" : "URL"}
                </Label>
                <Input
                  id="link-url"
                  value={draft.url}
                  onChange={(event) => updateUrl(event.target.value)}
                  placeholder={
                    type === "youtube"
                      ? "https://youtube.com/watch?v=…"
                      : "https://… or mailto:…"
                  }
                  aria-invalid={Boolean(errors.url || errors["config.videoId"])}
                  aria-describedby="link-url-hint link-url-error"
                  spellCheck={false}
                />
                <FieldHint>
                  <span id="link-url-hint">
                    {type === "youtube"
                      ? "Paste a YouTube video, Shorts or youtu.be link."
                      : "Allowed: http://, https:// or mailto: links."}
                  </span>
                </FieldHint>
                <FieldError>
                  {errors.url || errors["config.videoId"] ? (
                    <span id="link-url-error">
                      {errors.url ?? errors["config.videoId"]}
                    </span>
                  ) : null}
                </FieldError>
                {type === "youtube" && youtubeId ? (
                  <div className="mt-2 flex items-center gap-3 rounded-lg border border-line bg-zinc-50 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element -- preview */}
                    <img
                      src={`https://i.ytimg.com/vi/${youtubeId}/default.jpg`}
                      alt=""
                      className="h-12 w-20 rounded object-cover"
                    />
                    <span className="text-xs text-zinc-600">
                      Video ready to embed on your profile.
                    </span>
                  </div>
                ) : null}
              </div>
            ) : null}

            {type === "link" ? (
              <>
                <fieldset className="mb-3.5">
                  <legend className="mb-2 text-sm font-semibold text-zinc-800">Card layout</legend>
                  <div className="grid grid-cols-3 gap-2">
                    {LAYOUT_OPTIONS.map((option) => (
                      <label key={option.value} className="cursor-pointer">
                        <input
                          type="radio"
                          name="link-layout"
                          value={option.value}
                          checked={layout === option.value}
                          onChange={() => updateConfig("layout", option.value)}
                          className="peer sr-only"
                        />
                        <span className="block rounded-lg border-2 border-zinc-200 bg-white p-2 text-center text-xs font-semibold text-zinc-700 transition peer-checked:border-violet-700 peer-checked:bg-violet-50 peer-focus-visible:ring-4 peer-focus-visible:ring-violet-200">
                          <span className="mx-auto mb-1.5 block h-8 w-14 rounded-md border border-violet-200 bg-violet-100" />
                          <span className="block">{option.label}</span>
                          <span className="mt-0.5 block text-[10px] font-normal leading-tight text-zinc-500">
                            {option.blurb}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="mb-3.5">
                  <Label htmlFor="link-subtitle">Subtitle (optional)</Label>
                  <Input
                    id="link-subtitle"
                    value={configString(draft.config, "subtitle")}
                    onChange={(event) => updateConfig("subtitle", event.target.value)}
                    placeholder="YouTube · New video"
                    maxLength={LIMITS.maxSubtitle}
                    aria-invalid={Boolean(errors["config.subtitle"])}
                  />
                  <FieldError>{errors["config.subtitle"]}</FieldError>
                </div>

                {layout !== "classic" ? (
                  <div className="mb-3.5">
                    <Label htmlFor="link-image">Image URL (optional)</Label>
                    <Input
                      id="link-image"
                      value={imageUrl}
                      onChange={(event) => updateConfig("imageUrl", event.target.value)}
                      placeholder="https://…/thumbnail.jpg"
                      spellCheck={false}
                      aria-invalid={Boolean(errors["config.imageUrl"])}
                    />
                    <FieldHint>
                      Use a public https:// image. Uploads arrive in a later release.
                    </FieldHint>
                    <FieldError>{errors["config.imageUrl"]}</FieldError>
                    {imageUrl ? (
                      <div className="mt-2 flex items-center gap-3 rounded-lg border border-line bg-zinc-50 p-2">
                        {/* eslint-disable-next-line @next/next/no-img-element -- preview */}
                        <img
                          src={imageUrl}
                          alt=""
                          className={cn(
                            "rounded object-cover",
                            layout === "featured" ? "h-16 w-28" : "size-12",
                          )}
                        />
                        <span className="text-xs text-zinc-600">
                          {layout === "featured"
                            ? "Shown as a large image card."
                            : "Shown as the card thumbnail."}
                        </span>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="mb-3.5">
                  <Label htmlFor="link-icon">Icon</Label>
                  <div className="flex items-center gap-2">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-line bg-violet-50 text-violet-800">
                      {iconPreview}
                    </span>
                    <Select
                      id="link-icon"
                      value={draft.icon}
                      onChange={(event) => update("icon", event.target.value as LinkIconId)}
                      className="w-40"
                    >
                      {LINK_ICON_IDS.map((icon) => (
                        <option key={icon} value={icon}>
                          {ICON_LABELS[icon]}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex items-end justify-between">
                    <Label htmlFor="link-description">Description (optional)</Label>
                    <span className="mb-1.5 text-xs text-zinc-500">
                      {draft.description.length} / {LIMITS.maxLinkDescription}
                    </span>
                  </div>
                  <Textarea
                    id="link-description"
                    value={draft.description}
                    onChange={(event) => update("description", event.target.value)}
                    maxLength={LIMITS.maxLinkDescription}
                    placeholder="A short note shown when descriptions are enabled."
                    className="min-h-20"
                  />
                  <FieldError>{errors.description}</FieldError>
                </div>
              </>
            ) : null}

            {type === "header" ? (
              <div className="mb-4">
                <Label htmlFor="header-subtitle">Subtitle (optional)</Label>
                <Input
                  id="header-subtitle"
                  value={configString(draft.config, "subtitle")}
                  onChange={(event) => updateConfig("subtitle", event.target.value)}
                  placeholder="A short line under the heading"
                  maxLength={LIMITS.maxSubtitle}
                  aria-invalid={Boolean(errors["config.subtitle"])}
                />
                <FieldError>{errors["config.subtitle"]}</FieldError>
              </div>
            ) : null}

            {type === "contact" ? (
              <div className="mb-4 space-y-3">
                <div>
                  <Label htmlFor="contact-email">Email</Label>
                  <Input
                    id="contact-email"
                    type="email"
                    value={configString(draft.config, "email")}
                    onChange={(event) => updateConfig("email", event.target.value)}
                    placeholder="you@example.com"
                    aria-invalid={Boolean(errors["config.email"] || errors.config)}
                  />
                  <FieldError>{errors["config.email"]}</FieldError>
                </div>
                <div>
                  <Label htmlFor="contact-phone">Phone</Label>
                  <Input
                    id="contact-phone"
                    type="tel"
                    value={configString(draft.config, "phone")}
                    onChange={(event) => updateConfig("phone", event.target.value)}
                    placeholder="+91 98765 43210"
                    aria-invalid={Boolean(errors["config.phone"] || errors.config)}
                  />
                  <FieldError>{errors["config.phone"]}</FieldError>
                </div>
                <div>
                  <Label htmlFor="contact-whatsapp">WhatsApp</Label>
                  <Input
                    id="contact-whatsapp"
                    type="tel"
                    value={configString(draft.config, "whatsapp")}
                    onChange={(event) => updateConfig("whatsapp", event.target.value)}
                    placeholder="+91 98765 43210"
                    aria-invalid={Boolean(errors["config.whatsapp"] || errors.config)}
                  />
                  <FieldError>{errors["config.whatsapp"]}</FieldError>
                </div>
                <FieldError>{errors.config}</FieldError>
                <FieldHint>
                  These details are visible to anyone who opens your public page.
                </FieldHint>
              </div>
            ) : null}

            <div className="mb-3.5">
              <Label htmlFor="block-category">Category</Label>
              <Select
                id="block-category"
                value={draft.categoryId ?? ""}
                onChange={(event) => update("categoryId", event.target.value || null)}
              >
                <option value="">Uncategorized</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                    {category.isVisible ? "" : " (hidden)"}
                  </option>
                ))}
              </Select>
            </div>

            <div className="mb-5 flex items-start gap-2.5">
              <Checkbox
                id="link-active"
                checked={draft.isActive}
                onCheckedChange={(checked) => update("isActive", checked === true)}
                className="mt-0.5"
              />
              <div>
                <Label htmlFor="link-active" className="mb-0 cursor-pointer font-medium">
                  Active
                </Label>
                <p className="text-xs text-zinc-500">Show this block on your public profile.</p>
              </div>
            </div>

            <DialogFooter>
              {!isEditing ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setStep("type")}
                  disabled={submitting}
                >
                  Back
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => onOpenChange(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
              )}
              <Button type="submit" disabled={limitReached || submitting} loading={submitting}>
                {isEditing ? "Save block" : "Add block"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
