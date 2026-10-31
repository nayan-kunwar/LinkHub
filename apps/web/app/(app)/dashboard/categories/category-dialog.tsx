"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Check } from "lucide-react";
import type { Category, CategoryFormValues, CategoryIconId } from "@linkhub/shared";
import {
  CATEGORY_ICON_IDS,
  COLOR_PALETTE,
  LIMITS,
  categoryFormSchema,
} from "@linkhub/shared";
import { CategoryIcon } from "@/components/category-icon";
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
import { FieldError, Input, Label, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const ICON_LABELS: Record<CategoryIconId, string> = {
  folder: "Folder",
  share: "Share",
  code: "Code",
  briefcase: "Briefcase",
  book: "Book",
  mail: "Mail",
  archive: "Archive",
  globe: "Globe",
  star: "Star",
  heart: "Heart",
  link: "Link",
  palette: "Palette",
  music: "Music",
  camera: "Camera",
  coffee: "Coffee",
  sparkles: "Sparkles",
};

function emptyValues(): CategoryFormValues {
  return {
    name: "",
    description: "",
    color: "#7c3aed",
    icon: "code",
    isVisible: true,
  };
}

export function CategoryDialog({
  open,
  onOpenChange,
  category,
  categories,
  categoryCount,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Category | null;
  categories: Category[];
  categoryCount: number;
  onSubmit: (values: CategoryFormValues) => Promise<void> | void;
}) {
  const [values, setValues] = useState<CategoryFormValues>(emptyValues);
  const [errors, setErrors] = useState<Partial<Record<keyof CategoryFormValues, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const limitReached = !category && categoryCount >= LIMITS.maxCategories;

  useEffect(() => {
    if (!open) return;
    setValues(
      category
        ? {
            name: category.name,
            description: category.description,
            color: category.color,
            icon: category.icon,
            isVisible: category.isVisible,
          }
        : emptyValues(),
    );
    setErrors({});
  }, [open, category]);

  const update = <Key extends keyof CategoryFormValues>(
    key: Key,
    value: CategoryFormValues[Key],
  ) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || limitReached) return;

    const parsed = categoryFormSchema.safeParse(values);
    if (!parsed.success) {
      const nextErrors: Partial<Record<keyof CategoryFormValues, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof CategoryFormValues;
        if (!nextErrors[key]) nextErrors[key] = issue.message;
      }
      setErrors(nextErrors);
      return;
    }

    const duplicate = categories.some(
      (item) =>
        item.id !== category?.id &&
        item.name.trim().toLowerCase() === parsed.data.name.toLowerCase(),
    );
    if (duplicate) {
      setErrors({ name: "A category with this name already exists." });
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(parsed.data);
    } finally {
      setSubmitting(false);
    }
  };

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
          <DialogTitle>{category ? "Edit category" : "Add category"}</DialogTitle>
          <DialogDescription>
            Categories group links on your profile and can be shown or hidden at any time.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} noValidate>
          {limitReached ? (
            <div
              role="alert"
              className="mb-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>
                You&apos;ve reached the {LIMITS.maxCategories}-category limit. Delete a category
                before adding another.
              </span>
            </div>
          ) : null}

          <div className="mb-3.5">
            <div className="flex items-end justify-between">
              <Label htmlFor="category-name">Name</Label>
              <span className="mb-1.5 text-xs text-zinc-500">
                {values.name.length} / {LIMITS.maxCategoryName}
              </span>
            </div>
            <Input
              id="category-name"
              value={values.name}
              onChange={(event) => update("name", event.target.value)}
              maxLength={LIMITS.maxCategoryName}
              placeholder="Projects"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "category-name-error" : undefined}
              autoFocus
            />
            <FieldError>
              {errors.name ? <span id="category-name-error">{errors.name}</span> : null}
            </FieldError>
          </div>

          <div className="mb-3.5">
            <div className="flex items-end justify-between">
              <Label htmlFor="category-description">Description (optional)</Label>
              <span className="mb-1.5 text-xs text-zinc-500">
                {values.description.length} / {LIMITS.maxCategoryDescription}
              </span>
            </div>
            <Textarea
              id="category-description"
              value={values.description}
              onChange={(event) => update("description", event.target.value)}
              maxLength={LIMITS.maxCategoryDescription}
              placeholder="A short note shown under the category heading."
              className="min-h-16"
            />
            <FieldError>{errors.description}</FieldError>
          </div>

          <fieldset className="mb-4">
            <legend className="mb-1.5 block text-sm font-semibold text-zinc-800">Color</legend>
            <div className="flex flex-wrap gap-2.5">
              {COLOR_PALETTE.map((color) => (
                <label key={color} className="cursor-pointer" aria-label={`Color ${color}`}>
                  <input
                    type="radio"
                    name="category-color"
                    value={color}
                    checked={values.color === color}
                    onChange={() => update("color", color)}
                    className="peer sr-only"
                  />
                  <span
                    className="flex size-8 items-center justify-center rounded-full ring-offset-2 transition peer-checked:ring-2 peer-checked:ring-violet-700 peer-focus-visible:ring-4 peer-focus-visible:ring-violet-200"
                    style={{ backgroundColor: color }}
                  >
                    {values.color === color ? (
                      <Check aria-hidden="true" className="size-4 text-white drop-shadow" strokeWidth={3} />
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
            <FieldError>{errors.color}</FieldError>
          </fieldset>

          <fieldset className="mb-4">
            <legend className="mb-1.5 block text-sm font-semibold text-zinc-800">Icon</legend>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_ICON_IDS.map((icon) => (
                <label key={icon} className="cursor-pointer" aria-label={ICON_LABELS[icon]}>
                  <input
                    type="radio"
                    name="category-icon"
                    value={icon}
                    checked={values.icon === icon}
                    onChange={() => update("icon", icon)}
                    className="peer sr-only"
                  />
                  <span
                    className={cn(
                      "flex size-10 items-center justify-center rounded-xl border-2 border-zinc-200 bg-white text-zinc-600 transition",
                      "peer-checked:border-violet-700 peer-checked:bg-violet-50 peer-checked:text-violet-800",
                      "peer-focus-visible:ring-4 peer-focus-visible:ring-violet-200",
                    )}
                  >
                    <CategoryIcon icon={icon} className="size-5" />
                  </span>
                </label>
              ))}
            </div>
            <FieldError>{errors.icon}</FieldError>
          </fieldset>

          <div className="mb-5 flex items-start gap-2.5">
            <Checkbox
              id="category-visible"
              checked={values.isVisible}
              onCheckedChange={(checked) => update("isVisible", checked === true)}
              className="mt-0.5"
            />
            <div>
              <Label htmlFor="category-visible" className="mb-0 cursor-pointer font-medium">
                Visible on profile
              </Label>
              <p className="text-xs text-zinc-500">
                Links in a hidden category stay off your public page.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={limitReached || submitting} loading={submitting}>
              {category ? "Save category" : "Add category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
