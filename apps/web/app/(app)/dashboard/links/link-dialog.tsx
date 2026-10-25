"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle } from "lucide-react";
import type { Category, Link as LinkRecord, LinkFormValues, LinkIconId } from "@linkhub/shared";
import { LIMITS, linkFormSchema, LINK_ICON_IDS } from "@linkhub/shared";
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
};

function emptyValues(): LinkFormValues {
  return {
    title: "",
    url: "",
    categoryId: null,
    description: "",
    icon: "auto",
    isActive: true,
  };
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
  onSubmit: (values: LinkFormValues) => void;
}) {
  const [values, setValues] = useState<LinkFormValues>(emptyValues);
  const [errors, setErrors] = useState<Partial<Record<keyof LinkFormValues, string>>>({});
  const [limitError, setLimitError] = useState("");
  const limitReached = !link && linkCount >= LIMITS.maxLinks;

  useEffect(() => {
    if (!open) return;
    setValues(
      link
        ? {
            title: link.title,
            url: link.url,
            categoryId: link.categoryId,
            description: link.description,
            icon: link.icon,
            isActive: link.isActive,
          }
        : emptyValues(),
    );
    setErrors({});
    setLimitError("");
  }, [open, link]);

  const update = <Key extends keyof LinkFormValues>(key: Key, value: LinkFormValues[Key]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setLimitError("");
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (limitReached) {
      setLimitError(`The free plan supports up to ${LIMITS.maxLinks} links.`);
      return;
    }
    const parsed = linkFormSchema.safeParse(values);
    if (!parsed.success) {
      const nextErrors: Partial<Record<keyof LinkFormValues, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof LinkFormValues;
        if (!nextErrors[key]) nextErrors[key] = issue.message;
      }
      setErrors(nextErrors);
      return;
    }
    onSubmit(parsed.data);
  };

  const iconPreview = useMemo(
    () => <LinkIcon icon={values.icon} url={values.url || "https://example.com"} className="size-5" />,
    [values.icon, values.url],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{link ? "Edit link" : "Add link"}</DialogTitle>
          <DialogDescription>
            {link ? "Update how this link appears on your public profile." : "Add a destination and choose where it appears."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} noValidate>
          {limitReached || limitError ? (
            <div role="alert" className="mb-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>
                {limitReached
                  ? `You've reached the ${LIMITS.maxLinks}-link limit on the free plan. Delete a link before adding another.`
                  : limitError}
              </span>
            </div>
          ) : null}

          <div className="mb-3.5">
            <Label htmlFor="link-title">Title</Label>
            <Input
              id="link-title"
              value={values.title}
              onChange={(event) => update("title", event.target.value)}
              placeholder="My portfolio"
              maxLength={LIMITS.maxLinkTitle}
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? "link-title-error" : undefined}
              autoFocus
            />
            <FieldError>
              {errors.title ? <span id="link-title-error">{errors.title}</span> : null}
            </FieldError>
          </div>

          <div className="mb-3.5">
            <Label htmlFor="link-url">URL</Label>
            <Input
              id="link-url"
              value={values.url}
              onChange={(event) => update("url", event.target.value)}
              placeholder="https://… or mailto:…"
              aria-invalid={Boolean(errors.url)}
              aria-describedby="link-url-hint link-url-error"
              spellCheck={false}
            />
            <FieldHint>
              <span id="link-url-hint">Allowed: http://, https:// or mailto: links.</span>
            </FieldHint>
            <FieldError>
              {errors.url ? <span id="link-url-error">{errors.url}</span> : null}
            </FieldError>
          </div>

          <div className="mb-3.5 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
            <div>
              <Label htmlFor="link-category">Category</Label>
              <Select
                id="link-category"
                value={values.categoryId ?? ""}
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
            <div>
              <Label htmlFor="link-icon">Icon</Label>
              <div className="flex items-center gap-2">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-line bg-violet-50 text-violet-800">
                  {iconPreview}
                </span>
                <Select
                  id="link-icon"
                  value={values.icon}
                  onChange={(event) => update("icon", event.target.value as LinkIconId)}
                  className="w-36"
                >
                  {LINK_ICON_IDS.map((icon) => (
                    <option key={icon} value={icon}>
                      {ICON_LABELS[icon]}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-end justify-between">
              <Label htmlFor="link-description">Description (optional)</Label>
              <span className="mb-1.5 text-xs text-zinc-500">
                {values.description.length} / {LIMITS.maxLinkDescription}
              </span>
            </div>
            <Textarea
              id="link-description"
              value={values.description}
              onChange={(event) => update("description", event.target.value)}
              maxLength={LIMITS.maxLinkDescription}
              placeholder="A short note shown when descriptions are enabled."
              className="min-h-20"
            />
            <FieldError>{errors.description}</FieldError>
          </div>

          <div className="mb-5 flex items-start gap-2.5">
            <Checkbox
              id="link-active"
              checked={values.isActive}
              onCheckedChange={(checked) => update("isActive", checked === true)}
              className="mt-0.5"
            />
            <div>
              <Label htmlFor="link-active" className="mb-0 cursor-pointer font-medium">
                Active
              </Label>
              <p className="text-xs text-zinc-500">Show this link on your public profile.</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={limitReached}>
              {link ? "Save link" : "Add link"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
