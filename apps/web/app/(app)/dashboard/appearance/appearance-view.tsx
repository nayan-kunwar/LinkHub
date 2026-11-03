"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Eye,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import type {
  AppearanceColorKey,
  AppearanceSettings,
  ThemeId,
  ThemePresetDef,
} from "@linkhub/shared";
import {
  APPEARANCE_COLOR_KEYS,
  AUTO_COLOR,
  BACKGROUND_STYLES,
  BUTTON_STYLES,
  CARD_STYLES,
  FONT_CHOICES,
  PROFILE_LAYOUTS,
  THEME_PRESETS,
  normalizeHexColor,
} from "@linkhub/shared";
import { DashboardFrame } from "@/components/dashboard-frame";
import { DashboardPreview } from "@/components/dashboard-preview";
import { PageHeader } from "@/components/page-header";
import { PhoneFrame } from "@/components/phone-frame";
import { ProfileView } from "@/components/profile-view";
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
import { Switch } from "@/components/ui/switch";
import {
  applyThemePreset,
  backgroundFor,
  BUTTON_LABELS,
  CARD_LABELS,
  defaultButtonText,
  paletteContrast,
  resolvedPalette,
  themeFor,
} from "@/lib/appearance";
import { DEFAULT_APPEARANCE } from "@/lib/app-state";
import { useAppData } from "@/lib/store";
import { usePendingAction } from "@/lib/use-pending-action";
import { cn } from "@/lib/utils";

const LAYOUT_LABELS: Record<(typeof PROFILE_LAYOUTS)[number], string> = {
  grouped: "Grouped",
  flat: "Simple list",
};

const FONT_LABELS: Record<(typeof FONT_CHOICES)[number], string> = {
  sans: "Sans",
  serif: "Serif",
};

const BACKGROUND_LABELS: Record<(typeof BACKGROUND_STYLES)[number], string> = {
  solid: "Solid",
  gradient: "Gradient",
  pattern: "Pattern",
  blur: "Blur",
};

const BACKGROUND_NOTES: Record<
  (typeof BACKGROUND_STYLES)[number],
  string
> = {
  solid: "Used as the page background",
  gradient: "Gradient is generated from this color",
  pattern: "Pattern is drawn over this color",
  blur: "Blur glows use this color",
};

const COLOR_META: Record<
  AppearanceColorKey,
  { label: string; note: string; auto: boolean }
> = {
  background: {
    label: "Background",
    note: BACKGROUND_NOTES.gradient,
    auto: false,
  },
  buttons: {
    label: "Buttons",
    note: "Link-card fill and accent",
    auto: false,
  },
  buttonText: {
    label: "Button text",
    note: "Text on Brand-style buttons",
    auto: true,
  },
  pageText: {
    label: "Page text",
    note: "Bio, descriptions and muted copy",
    auto: true,
  },
  title: {
    label: "Title",
    note: "Your name and category headings",
    auto: true,
  },
};

const TOGGLES = [
  { key: "showAvatar", label: "Show profile picture" },
  { key: "showBio", label: "Show bio" },
  { key: "showSocial", label: "Show social icons" },
  { key: "showDescription", label: "Show link descriptions" },
] as const;

type Palette = Record<AppearanceColorKey, string>;
type HexValues = Record<AppearanceColorKey, string>;

function defaultAppearance(): AppearanceSettings {
  return structuredClone(DEFAULT_APPEARANCE);
}

function sameColor(left: string, right: string): boolean {
  const first = normalizeHexColor(left);
  const second = normalizeHexColor(right);
  if (!first || !second) return left === right;
  return first === second;
}

/** The colours a preset uses when no override is stored. */
function presetPalette(preset: ThemePresetDef): Palette {
  const accent = preset.accent ?? DEFAULT_APPEARANCE.color;
  return {
    background: normalizeHexColor(preset.solid) ?? preset.solid,
    buttons: normalizeHexColor(accent) ?? accent,
    buttonText: defaultButtonText(accent),
    pageText: normalizeHexColor(preset.muted) ?? preset.muted,
    title: normalizeHexColor(preset.text) ?? preset.text,
  };
}

function storedColor(
  appearance: AppearanceSettings,
  key: AppearanceColorKey,
  fallback: Palette,
): string {
  if (key === "background") {
    return appearance.backgroundColor ?? fallback.background;
  }
  if (key === "buttons") return appearance.color;
  if (key === "buttonText") {
    return appearance.buttonTextColor ?? fallback.buttonText;
  }
  if (key === "pageText") {
    return appearance.pageTextColor ?? fallback.pageText;
  }
  return appearance.titleColor ?? fallback.title;
}

function displayValue(
  appearance: AppearanceSettings,
  key: AppearanceColorKey,
): string {
  const preset = themeFor(appearance);
  const fallback = presetPalette(preset);
  const value = storedColor(appearance, key, fallback);
  if (value === AUTO_COLOR) {
    return `Auto · ${resolvedPalette(appearance, preset)[key]}`;
  }
  return normalizeHexColor(value)?.slice(1) ?? value.replace(/^#/, "");
}

function hexValuesFor(appearance: AppearanceSettings): HexValues {
  return APPEARANCE_COLOR_KEYS.reduce((values, key) => {
    values[key] = displayValue(appearance, key);
    return values;
  }, {} as HexValues);
}

function withColor(
  appearance: AppearanceSettings,
  key: AppearanceColorKey,
  value: string | undefined,
  fallback: Palette,
): AppearanceSettings {
  if (key === "background") {
    return { ...appearance, backgroundColor: value };
  }
  if (key === "buttons") {
    return { ...appearance, color: value ?? fallback.buttons };
  }
  if (key === "buttonText") {
    return { ...appearance, buttonTextColor: value };
  }
  if (key === "pageText") {
    return { ...appearance, pageTextColor: value };
  }
  return { ...appearance, titleColor: value };
}

function isPresetExact(
  appearance: AppearanceSettings,
  preset: ThemePresetDef,
): boolean {
  const fallback = presetPalette(preset);
  const colorsMatch = APPEARANCE_COLOR_KEYS.every((key) =>
    sameColor(storedColor(appearance, key, fallback), fallback[key]),
  );
  return (
    colorsMatch &&
    appearance.background === DEFAULT_APPEARANCE.background &&
    appearance.font === (preset.font ?? DEFAULT_APPEARANCE.font) &&
    appearance.card === (preset.card ?? DEFAULT_APPEARANCE.card) &&
    appearance.button === (preset.button ?? DEFAULT_APPEARANCE.button)
  );
}

function colorsAreCustom(
  appearance: AppearanceSettings,
  preset: ThemePresetDef,
): boolean {
  const fallback = presetPalette(preset);
  return APPEARANCE_COLOR_KEYS.some(
    (key) => !sameColor(storedColor(appearance, key, fallback), fallback[key]),
  );
}

function AutoToggle({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={`Auto ${label.toLowerCase()} color`}
      onClick={() => onCheckedChange(!checked)}
      className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-md py-1 text-zinc-500 transition hover:text-violet-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
    >
      <span
        aria-hidden="true"
        className={cn(
          "relative h-4 w-7 rounded-full bg-zinc-300 transition-colors",
          checked && "bg-violet-700",
        )}
      >
        <span
          className={cn(
            "absolute left-0.5 top-0.5 size-3 rounded-full bg-white shadow-sm transition-transform",
            checked && "translate-x-3",
          )}
        />
      </span>
      <span
        className={cn(
          "text-[9px] font-bold uppercase tracking-wide",
          checked ? "text-violet-700" : "text-zinc-500",
        )}
      >
        Auto
      </span>
    </button>
  );
}

function Segmented<Value extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: Value;
  options: readonly { value: Value; label: string }[];
  onChange: (value: Value) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-xs font-semibold text-zinc-800">
        {label}
      </legend>
      <div
        className="grid gap-1 rounded-lg bg-zinc-100 p-1"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((option) => (
          <label key={option.value} className="cursor-pointer">
            <input
              type="radio"
              name={`appearance-${label}`}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="peer sr-only"
            />
            <span className="block rounded-md px-1.5 py-1.5 text-center text-[11.5px] font-semibold text-zinc-600 transition peer-checked:bg-white peer-checked:text-violet-900 peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-violet-300">
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function AppearanceView() {
  const { state, hydrated, setAppearance } = useAppData();
  const { pending, run } = usePendingAction();
  const [draft, setDraft] = useState<AppearanceSettings>(() =>
    structuredClone(state.appearance),
  );
  const [hexValues, setHexValues] = useState<HexValues>(() =>
    hexValuesFor(state.appearance),
  );
  const [invalidKeys, setInvalidKeys] = useState<Set<AppearanceColorKey>>(
    () => new Set(),
  );
  const [resetOpen, setResetOpen] = useState(false);
  const [presetTarget, setPresetTarget] = useState<ThemeId | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const presetCancelRef = useRef<HTMLButtonElement>(null);

  const activePreset = themeFor(draft);
  const activePalette = presetPalette(activePreset);
  const palette = resolvedPalette(draft, activePreset);
  const dirty = JSON.stringify(draft) !== JSON.stringify(state.appearance);
  const invalidCount = invalidKeys.size;
  const canSave = dirty && invalidCount === 0;
  const showSaveBar = dirty || invalidCount > 0;
  const activePresetName = activePreset.name;
  const customDesign = !isPresetExact(draft, activePreset);
  const customColors = colorsAreCustom(draft, activePreset);
  const saveState = invalidCount > 0 ? "Fix invalid hex" : dirty ? "Unsaved changes" : "Saved";
  const optionsSummary = `${BACKGROUND_LABELS[draft.background]} background · ${
    BUTTON_LABELS[draft.button]
  } buttons · ${CARD_LABELS[draft.card]} corners`;

  const pendingPreset = presetTarget
    ? THEME_PRESETS.find((preset) => preset.id === presetTarget) ?? null
    : null;

  useEffect(() => {
    if (!hydrated) return;
    const next = structuredClone(state.appearance);
    setDraft(next);
    setHexValues(hexValuesFor(next));
    setInvalidKeys(new Set());
  }, [hydrated, state.appearance]);

  useEffect(() => {
    if (!dirty && invalidCount === 0) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, invalidCount]);

  // Keep Auto displays and preset/reset changes in sync without overwriting
  // the field the user is currently typing into.
  useEffect(() => {
    setHexValues((current) => {
      const activeKey =
        typeof document !== "undefined"
          ? document.activeElement?.getAttribute("data-color-input")
          : null;
      let changed = false;
      const next = { ...current };
      for (const key of APPEARANCE_COLOR_KEYS) {
        if (activeKey === key) continue;
        const target = displayValue(draft, key);
        if (next[key] !== target) {
          next[key] = target;
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [draft]);

  const update = <Key extends keyof AppearanceSettings>(
    key: Key,
    value: AppearanceSettings[Key],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const markInvalid = (key: AppearanceColorKey) => {
    setInvalidKeys((current) => {
      if (current.has(key)) return current;
      const next = new Set(current);
      next.add(key);
      return next;
    });
  };

  const clearInvalid = (key?: AppearanceColorKey) => {
    setInvalidKeys((current) => {
      if (key === undefined) return new Set();
      if (!current.has(key)) return current;
      const next = new Set(current);
      next.delete(key);
      return next;
    });
  };

  const setColorValue = (
    key: AppearanceColorKey,
    value: string | undefined,
  ) => {
    let normalized = value;
    if (value && value !== AUTO_COLOR) {
      normalized = normalizeHexColor(value) ?? undefined;
    }
    if (
      key !== "buttons" &&
      normalized &&
      normalized !== AUTO_COLOR &&
      sameColor(normalized, activePalette[key])
    ) {
      normalized = undefined;
    }
    setDraft((current) =>
      withColor(
        current,
        key,
        normalized,
        presetPalette(themeFor(current)),
      ),
    );
  };

  const onHexChange = (key: AppearanceColorKey, rawValue: string) => {
    const raw = rawValue
      .replace(/^#+/, "")
      .replace(/[^0-9a-f]/gi, "")
      .slice(0, 6)
      .toUpperCase();
    setHexValues((current) => ({ ...current, [key]: raw }));

    const normalized = normalizeHexColor(raw);
    if (normalized && (raw.length === 3 || raw.length === 6)) {
      clearInvalid(key);
      setColorValue(key, normalized);
    } else {
      markInvalid(key);
    }
  };

  const onHexBlur = (key: AppearanceColorKey) => {
    if (storedColor(draft, key, activePalette) === AUTO_COLOR) return;
    const normalized = normalizeHexColor(hexValues[key]);
    clearInvalid(key);
    if (normalized) {
      setColorValue(key, normalized);
      setHexValues((current) => ({
        ...current,
        [key]: normalized.slice(1),
      }));
      return;
    }
    setHexValues((current) => ({
      ...current,
      [key]: displayValue(draft, key),
    }));
    toast("Hex colors need 3 or 6 characters. Reverted to the last valid value.", {
      className: "appearance-toast",
    });
  };

  const toggleAuto = (key: AppearanceColorKey) => {
    const isAuto = storedColor(draft, key, activePalette) === AUTO_COLOR;
    // Turning Auto off keeps the colour it picked, so the user can adjust it.
    const nextValue = isAuto ? palette[key] : AUTO_COLOR;
    const nextAppearance = withColor(
      draft,
      key,
      nextValue,
      activePalette,
    );
    setColorValue(key, nextValue);
    clearInvalid(key);
    const picked = resolvedPalette(nextAppearance, themeFor(nextAppearance))[key];
    toast(
      isAuto
        ? `${COLOR_META[key].label} set to ${picked}.`
        : `${COLOR_META[key].label} set to Auto · ${picked}.`,
      { className: "appearance-toast" },
    );
  };

  const resetRow = (key: AppearanceColorKey) => {
    setColorValue(key, undefined);
    clearInvalid(key);
    toast(`${COLOR_META[key].label} reset to ${activePresetName}.`, {
      className: "appearance-toast",
    });
  };

  const resetColors = () => {
    const next: AppearanceSettings = {
      ...draft,
      color: activePalette.buttons,
      backgroundColor: undefined,
      buttonTextColor: undefined,
      pageTextColor: undefined,
      titleColor: undefined,
    };
    setDraft(next);
    setHexValues(hexValuesFor(next));
    clearInvalid();
    toast(`Colors reset to ${activePresetName}.`, {
      className: "appearance-toast",
    });
  };

  const applyPresetNow = (preset: ThemePresetDef) => {
    const previous = structuredClone(draft);
    const next = applyThemePreset(draft, preset, { force: true });
    setDraft(next);
    setHexValues(hexValuesFor(next));
    clearInvalid();
    toast(`Applied ${preset.name}.`, {
      className: "appearance-toast",
      duration: 8000,
      action: {
        label: "Undo",
        onClick: () => {
          const restored = structuredClone(previous);
          setDraft(restored);
          setHexValues(hexValuesFor(restored));
          clearInvalid();
          toast("Previous colors restored.", {
            className: "appearance-toast",
          });
        },
      },
    });
  };

  const choosePreset = (preset: ThemePresetDef) => {
    if (colorsAreCustom(draft, activePreset)) {
      setPresetTarget(preset.id as ThemeId);
      return;
    }
    applyPresetNow(preset);
  };

  const confirmPreset = () => {
    if (!pendingPreset) return;
    const preset = pendingPreset;
    setPresetTarget(null);
    applyPresetNow(preset);
  };

  const saveDraft = async () => {
    if (invalidCount > 0) {
      toast("Fix the highlighted hex value before saving.", {
        className: "appearance-toast",
      });
      const first = document.querySelector<HTMLInputElement>(
        '[data-color-input][aria-invalid="true"]',
      );
      first?.focus();
      return;
    }
    if (!dirty) return;
    const ok = await setAppearance(draft);
    if (ok) {
      toast.success("Colors saved — your preview is up to date.", {
        className: "appearance-toast",
      });
    }
  };

  const cancelDraft = () => {
    if (!dirty && invalidCount === 0) return;
    const next = structuredClone(state.appearance);
    setDraft(next);
    setHexValues(hexValuesFor(next));
    clearInvalid();
    toast("Changes discarded.", { className: "appearance-toast" });
  };

  const resetDraft = () => {
    const next = defaultAppearance();
    setDraft(next);
    setHexValues(hexValuesFor(next));
    clearInvalid();
    setResetOpen(false);
    toast("Reset to default — save to apply.", {
      className: "appearance-toast",
    });
  };

  return (
    <DashboardFrame
      className="pb-28 sm:pb-6"
      preview={<DashboardPreview title="Live preview" appearanceOverride={draft} />}
    >
      <PageHeader
        title="Appearance"
        description="Pick a palette and fine-tune your page. Changes preview live and apply when you save."
        actions={
          <div className="hidden items-center gap-2 sm:flex">
            <span
              role="status"
              aria-live="polite"
              className={cn(
                "inline-flex items-center gap-1.5 pr-1 text-xs font-semibold",
                invalidCount > 0
                  ? "text-red-700"
                  : dirty
                    ? "text-amber-800"
                    : "text-zinc-600",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "size-1.5 rounded-full",
                  invalidCount > 0
                    ? "bg-red-600"
                    : dirty
                      ? "bg-amber-500"
                      : "bg-emerald-500",
                )}
              />
              {saveState}
            </span>
            <Button
              variant="secondary"
              onClick={cancelDraft}
              disabled={(!dirty && invalidCount === 0) || pending !== null}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void run("save", saveDraft)}
              disabled={!canSave || pending !== null}
              loading={pending === "save"}
            >
              Save
            </Button>
          </div>
        }
      />

      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        Appearance
        <span aria-hidden="true" className="px-1.5 text-zinc-300">
          /
        </span>
        <span className="text-violet-800">Colors</span>
      </p>

      <div className="space-y-4">
        <Card className="p-5">
          <section aria-labelledby="appearance-theme">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 id="appearance-theme" className="font-bold text-zinc-900">
                  Theme
                </h2>
                <p className="mt-1 text-sm text-zinc-600">
                  Start with a preset. It sets all five colors, then you can
                  fine-tune below.
                </p>
              </div>
              {customDesign ? (
                <span
                  data-testid="theme-custom"
                  className="inline-flex shrink-0 items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800"
                >
                  Custom (based on {activePresetName})
                </span>
              ) : null}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {THEME_PRESETS.map((preset) => {
                const exact = isPresetExact(draft, preset);
                const base = draft.theme === preset.id && !exact;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    data-preset={preset.id}
                    aria-pressed={exact}
                    onClick={() => choosePreset(preset)}
                    className="group rounded-xl text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200"
                  >
                    <span
                      className={cn(
                        "relative block h-12 overflow-hidden rounded-lg border border-zinc-200 transition group-hover:-translate-y-0.5",
                        exact && "ring-2 ring-violet-700 ring-offset-2",
                        base && "ring-2 ring-violet-200",
                      )}
                      style={{ background: preset.background }}
                    >
                      {exact ? (
                        <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-white text-violet-800 shadow-sm">
                          <Check aria-hidden="true" className="size-2.5" strokeWidth={3} />
                        </span>
                      ) : null}
                    </span>
                    <span
                      className={cn(
                        "mt-1.5 block truncate text-[11.5px] font-semibold text-zinc-600",
                        exact && "text-violet-900",
                        base && "text-violet-800",
                      )}
                    >
                      {preset.name}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
              <p className="text-[11px] text-zinc-500">
                Presets also set fonts, corners and button style.
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setResetOpen(true)}
                disabled={pending !== null}
              >
                Reset all appearance settings
              </Button>
            </div>
          </section>
        </Card>

        <Card className="p-5">
          <section aria-labelledby="appearance-palette">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="appearance-palette" className="font-bold text-zinc-900">
                  Palette
                </h2>
                <p className="mt-1 text-sm text-zinc-600">
                  Click a swatch or type a hex value. Your preview updates
                  instantly.
                </p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-500" />
                Live
              </span>
            </div>

            <div className="mt-3 divide-y divide-line">
              {APPEARANCE_COLOR_KEYS.map((key) => {
                const meta = COLOR_META[key];
                const value = storedColor(draft, key, activePalette);
                const isAuto = value === AUTO_COLOR;
                const custom = !isAuto && !sameColor(value, activePalette[key]);
                const invalid = invalidKeys.has(key);
                const ratio = paletteContrast(key, draft, activePreset);
                const warning =
                  !isAuto && !invalid && ratio !== null && ratio < 4.5;
                const note =
                  key === "background"
                    ? BACKGROUND_NOTES[draft.background]
                    : meta.note;
                return (
                  <div
                    key={key}
                    data-color-row={key}
                    className="grid grid-cols-[2.5rem_minmax(0,1fr)_2rem] items-center gap-x-3 gap-y-2 rounded-lg px-2 py-3 transition hover:bg-violet-50/40 sm:grid-cols-[minmax(0,1fr)_2.5rem_11.5rem_2rem]"
                  >
                    <div className="col-span-3 min-w-0 sm:col-span-1">
                      <p className="text-sm font-semibold text-zinc-900">
                        {meta.label}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] text-zinc-500">{note}</span>
                        {custom ? (
                          <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-1.5 py-px text-[9px] font-bold uppercase leading-4 tracking-wide text-violet-700">
                            Custom
                          </span>
                        ) : null}
                        {warning ? (
                          <span
                            title={`Contrast ${ratio.toFixed(1)}:1 — WCAG AA needs 4.5:1 for normal text. Adjust the ${
                              key === "buttonText" ? "button color" : "background color"
                            }.`}
                            className="inline-flex cursor-help items-center gap-1 text-[10.5px] font-semibold text-amber-700"
                          >
                            <AlertTriangle aria-hidden="true" className="size-3" />
                            Low contrast {ratio.toFixed(1)}:1
                          </span>
                        ) : null}
                        {invalid ? (
                          <span
                            id={`${key}-error`}
                            className="text-[10.5px] font-semibold text-red-700"
                          >
                            Use 3 or 6 hex characters
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <label
                      className={cn(
                        "relative block size-10 rounded-lg border border-zinc-900/15 shadow-sm transition",
                        isAuto
                          ? "cursor-default"
                          : "cursor-pointer hover:-translate-y-0.5 hover:shadow-md",
                      )}
                      style={{
                        background:
                          key === "background"
                            ? backgroundFor(draft, activePreset)
                            : palette[key],
                      }}
                      title={
                        isAuto
                          ? `Auto · ${palette[key]}`
                          : `Pick ${meta.label.toLowerCase()} color`
                      }
                    >
                      <input
                        type="color"
                        value={palette[key].toLowerCase()}
                        onChange={(event) => {
                          clearInvalid(key);
                          setColorValue(key, event.target.value);
                        }}
                        disabled={isAuto}
                        aria-label={`Choose ${meta.label.toLowerCase()} color`}
                        className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-default"
                      />
                    </label>

                    <div
                      className={cn(
                        "flex h-10 min-w-0 items-center gap-1 rounded-lg border border-violet-100 bg-violet-50/40 px-2.5 transition focus-within:border-violet-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-violet-100",
                        invalid && "border-red-300 bg-white ring-4 ring-red-100",
                        isAuto && "bg-violet-50/70",
                      )}
                    >
                      {!isAuto ? (
                        <span
                          aria-hidden="true"
                          className="shrink-0 font-mono text-xs text-zinc-400"
                        >
                          #
                        </span>
                      ) : null}
                      <input
                        data-color-input={key}
                        value={hexValues[key]}
                        onChange={(event) => onHexChange(key, event.target.value)}
                        onBlur={() => onHexBlur(key)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") event.currentTarget.blur();
                        }}
                        disabled={isAuto}
                        maxLength={7}
                        spellCheck={false}
                        autoComplete="off"
                        aria-label={
                          isAuto
                            ? `${meta.label} color, Auto ${palette[key]}`
                            : `${meta.label} hex color`
                        }
                        aria-invalid={invalid || undefined}
                        aria-describedby={invalid ? `${key}-error` : undefined}
                        className={cn(
                          "min-w-0 flex-1 bg-transparent font-mono text-xs font-semibold uppercase tracking-wide text-zinc-700 outline-none disabled:cursor-default disabled:text-violet-800 disabled:opacity-100",
                          isAuto && "normal-case tracking-normal",
                        )}
                      />
                      {meta.auto ? (
                        <AutoToggle
                          label={meta.label}
                          checked={isAuto}
                          onCheckedChange={() => toggleAuto(key)}
                        />
                      ) : null}
                    </div>

                    {custom || isAuto ? (
                      <button
                        type="button"
                        data-reset-color={key}
                        onClick={() => resetRow(key)}
                        aria-label={`Reset ${meta.label.toLowerCase()} to ${activePresetName}`}
                        title="Reset to preset"
                        className="inline-flex size-8 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-violet-50 hover:text-violet-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200"
                      >
                        <RotateCcw aria-hidden="true" className="size-3.5" />
                      </button>
                    ) : (
                      <span aria-hidden="true" />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
              <button
                type="button"
                onClick={resetColors}
                disabled={!customColors}
                className="rounded text-xs font-semibold text-violet-700 underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:text-zinc-400 disabled:no-underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200"
              >
                Reset colors to {activePresetName}
              </button>
              <span className="text-[11px] text-zinc-500">
                Hex values are saved with your appearance settings.
              </span>
            </div>
          </section>
        </Card>

        <details className="group overflow-hidden rounded-2xl border border-line bg-white shadow-card">
          <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 transition hover:bg-violet-50/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200 [&::-webkit-details-marker]:hidden">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-800">
              <SlidersHorizontal aria-hidden="true" className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <h2 className="text-sm font-bold text-zinc-900">
                Style &amp; layout
              </h2>
              <p className="mt-0.5 truncate text-[11.5px] text-zinc-500">
                {optionsSummary}
              </p>
            </span>
            <ChevronDown
              aria-hidden="true"
              className="size-4 shrink-0 text-zinc-400 transition group-open:rotate-180"
            />
          </summary>

          <div className="border-t border-line px-5 pb-5 pt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Segmented
                label="Background style"
                value={draft.background}
                options={BACKGROUND_STYLES.map((value) => ({
                  value,
                  label: BACKGROUND_LABELS[value],
                }))}
                onChange={(value) => update("background", value)}
              />
              <Segmented
                label="Button style"
                value={draft.button}
                options={BUTTON_STYLES.map((value) => ({
                  value,
                  label: BUTTON_LABELS[value],
                }))}
                onChange={(value) => update("button", value)}
              />
              <Segmented
                label="Card corners"
                value={draft.card}
                options={CARD_STYLES.map((value) => ({
                  value,
                  label: CARD_LABELS[value],
                }))}
                onChange={(value) => update("card", value)}
              />
              <Segmented
                label="Layout"
                value={draft.layout}
                options={PROFILE_LAYOUTS.map((value) => ({
                  value,
                  label: LAYOUT_LABELS[value],
                }))}
                onChange={(value) => update("layout", value)}
              />
              <Segmented
                label="Font"
                value={draft.font}
                options={FONT_CHOICES.map((value) => ({
                  value,
                  label: FONT_LABELS[value],
                }))}
                onChange={(value) => update("font", value)}
              />
            </div>

            <p className="mt-3 text-[11px] text-zinc-500">
              Gradient, pattern and blur styles all use your background color.
              Image backgrounds are coming later.
            </p>

            <fieldset className="mt-5 border-t border-line pt-4">
              <legend className="mb-2 text-xs font-semibold text-zinc-800">
                Visibility
              </legend>
              <ul className="grid gap-2 sm:grid-cols-2">
                {TOGGLES.map((toggle) => (
                  <li
                    key={toggle.key}
                    className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2 text-xs font-medium text-zinc-700"
                  >
                    <span id={`toggle-${toggle.key}`}>{toggle.label}</span>
                    <Switch
                      checked={draft[toggle.key]}
                      onCheckedChange={(checked) => update(toggle.key, checked)}
                      aria-labelledby={`toggle-${toggle.key}`}
                    />
                  </li>
                ))}
              </ul>
            </fieldset>
          </div>
        </details>

        <p className="text-xs text-zinc-500">
          Backgrounds are rendered with CSS; no image upload is required. Colors
          are stored with your appearance settings and apply when you save.
        </p>
      </div>

      <Button
        data-testid="appearance-preview-fab"
        onClick={() => setPreviewOpen(true)}
        aria-label="Open live preview"
        className={cn(
          "fixed right-4 z-40 size-12 rounded-full p-0 shadow-lg shadow-violet-900/30 xl:hidden",
          showSaveBar
            ? "bottom-[calc(4.75rem+env(safe-area-inset-bottom))] sm:bottom-5"
            : "bottom-5",
        )}
      >
        <Eye aria-hidden="true" className="size-5" />
        <span className="hidden sm:inline">Preview</span>
      </Button>

      {showSaveBar ? (
        <div
          data-testid="appearance-savebar"
          className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-line bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-14px_34px_-22px_rgba(76,29,149,0.45)] backdrop-blur sm:hidden"
        >
          <span
            role="status"
            aria-live="polite"
            className={cn(
              "inline-flex items-center gap-1.5 text-xs font-semibold",
              invalidCount > 0
                ? "text-red-700"
                : dirty
                  ? "text-amber-800"
                  : "text-zinc-600",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "size-1.5 rounded-full",
                invalidCount > 0
                  ? "bg-red-600"
                  : dirty
                    ? "bg-amber-500"
                    : "bg-emerald-500",
              )}
            />
            {saveState}
          </span>
          <div className="ml-auto flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={cancelDraft}
              disabled={(!dirty && invalidCount === 0) || pending !== null}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => void run("save", saveDraft)}
              disabled={!canSave || pending !== null}
              loading={pending === "save"}
            >
              Save
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-[380px] p-4">
          <DialogHeader className="mb-3">
            <DialogTitle>Live preview</DialogTitle>
            <DialogDescription>
              See how your public page looks with these colors.
            </DialogDescription>
          </DialogHeader>
          <PhoneFrame>
            <ProfileView
              profile={state.profile}
              categories={state.categories}
              links={state.links}
              appearance={draft}
              variant="phone"
              showUnpublishedNote
            />
          </PhoneFrame>
        </DialogContent>
      </Dialog>

      <Dialog
        open={presetTarget !== null}
        onOpenChange={(open) => {
          if (!open) setPresetTarget(null);
        }}
      >
        <DialogContent
          className="max-w-md"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            presetCancelRef.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {pendingPreset?.id === draft.theme
                ? "Reset your custom colors?"
                : "Replace your custom colors?"}
            </DialogTitle>
            <DialogDescription>
              {pendingPreset?.id === draft.theme ? (
                <>
                  This will reset your palette and style options to the{" "}
                  <strong>{pendingPreset?.name}</strong> preset. You can undo
                  right after.
                </>
              ) : (
                <>
                  Applying <strong>{pendingPreset?.name}</strong> will replace
                  all five colors and the style options. You can undo right
                  after.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              ref={presetCancelRef}
              variant="secondary"
              onClick={() => setPresetTarget(null)}
            >
              Keep my colors
            </Button>
            <Button onClick={confirmPreset}>
              {pendingPreset?.id === draft.theme
                ? `Reset to ${pendingPreset?.name}`
                : "Replace colors"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset to default?</DialogTitle>
            <DialogDescription>
              This restores every appearance setting, including the theme
              preset and all five colors, to its default value. Your unsaved
              choices are discarded.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button onClick={resetDraft}>Reset appearance</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardFrame>
  );
}
