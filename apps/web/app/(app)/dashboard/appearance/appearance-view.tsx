"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Image as ImageIcon,
  List as ListIcon,
  Palette,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Square,
  SquareRoundCorner,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
import { AppearancePreview } from "@/components/appearance-preview";
import { DashboardFrame } from "@/components/dashboard-frame";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

const PRESET_DESCRIPTIONS: Record<ThemeId, string> = {
  default: "Clean",
  dark: "Bold",
  ocean: "Airy",
  sunset: "Warm",
  forest: "Fresh",
  minimal: "Quiet",
  rose: "Soft",
  aurora: "Vivid",
  "soft-grey": "Neutral",
  "solid-pink": "Sweet",
  "maroon-serif": "Classic",
  illustrated: "Scenic",
  "pattern-sand": "Textured",
};

const BACKGROUND_NOTES: Record<(typeof BACKGROUND_STYLES)[number], string> = {
  solid: "Used as the page background",
  gradient: "Gradient from this color",
  pattern: "Pattern drawn over this color",
  blur: "Glow color for the background",
};

const COLOR_META: Record<
  AppearanceColorKey,
  { label: string; note: string; isText: boolean }
> = {
  background: {
    label: "Background",
    note: BACKGROUND_NOTES.gradient,
    isText: false,
  },
  buttons: {
    label: "Buttons",
    note: "Link-card fill and accent",
    isText: false,
  },
  buttonText: {
    label: "Button text",
    note: "Only used by Brand-style buttons",
    isText: true,
  },
  pageText: {
    label: "Page text",
    note: "Bio, descriptions and muted copy",
    isText: true,
  },
  title: {
    label: "Title",
    note: "Your name and category headings",
    isText: true,
  },
};

const TEXT_COLOR_KEYS = ["buttonText", "pageText", "title"] as const;

const TOGGLES = [
  { key: "showAvatar", label: "Profile picture" },
  { key: "showBio", label: "Bio" },
  { key: "showSocial", label: "Social icons" },
  { key: "showDescription", label: "Link descriptions" },
] as const;

type StyleField = "background" | "button" | "card" | "layout" | "font";
type StyleOption = { value: string; label: string; description: string };
type StyleSection = {
  key: StyleField;
  label: string;
  icon: LucideIcon | null;
  options: StyleOption[];
};

const STYLE_SECTIONS: StyleSection[] = [
  {
    key: "background",
    label: "Background",
    icon: ImageIcon,
    options: BACKGROUND_STYLES.map((value) => ({
      value,
      label: BACKGROUND_LABELS[value],
      description: {
        solid: "One flat color.",
        gradient: "A subtle blend of your color.",
        pattern: "A quiet dotted texture.",
        blur: "Soft color glows behind links.",
      }[value],
    })),
  },
  {
    key: "button",
    label: "Buttons",
    icon: Square,
    options: BUTTON_STYLES.map((value) => ({
      value,
      label: BUTTON_LABELS[value],
      description: {
        solid: "Clean cards with a light fill.",
        outline: "Bordered and transparent.",
        glass: "Frosted and translucent.",
        brand: "Filled with your button color.",
      }[value],
    })),
  },
  {
    key: "card",
    label: "Corners",
    icon: SquareRoundCorner,
    options: CARD_STYLES.map((value) => ({
      value,
      label: CARD_LABELS[value],
      description: {
        rounded: "Balanced 14px corners.",
        soft: "Friendly, larger curves.",
        minimal: "Sharp, nearly square.",
        pill: "Fully rounded ends.",
      }[value],
    })),
  },
  {
    key: "layout",
    label: "Layout",
    icon: ListIcon,
    options: PROFILE_LAYOUTS.map((value) => ({
      value,
      label: LAYOUT_LABELS[value],
      description: {
        grouped: "Links under category headings.",
        flat: "One continuous list of links.",
      }[value],
    })),
  },
  {
    key: "font",
    label: "Font",
    icon: null,
    options: FONT_CHOICES.map((value) => ({
      value,
      label: FONT_LABELS[value],
      description: {
        sans: "Modern and highly legible.",
        serif: "Editorial and expressive.",
      }[value],
    })),
  },
];

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

function isAutoPrefix(value: string): boolean {
  return /^auto/i.test(value.trim());
}

function StatusPill({
  label,
  tone,
  testId,
  className,
}: {
  label: string;
  tone: "saved" | "dirty" | "error";
  testId?: string;
  className?: string;
}) {
  return (
    <span
      role="status"
      aria-live="polite"
      data-testid={testId}
      className={cn(
        "inline-flex h-[26px] items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-[10.5px] font-semibold",
        tone === "error" && "border-red-200 bg-red-50 text-red-700",
        tone === "dirty" && "border-amber-200 bg-amber-50 text-amber-700",
        tone === "saved" && "border-emerald-200 bg-emerald-50 text-emerald-700",
        className,
      )}
    >
      <span aria-hidden="true" className="size-1 shrink-0 rounded-full bg-current" />
      {label}
    </span>
  );
}

function SectionHeader({
  id,
  icon: Icon,
  title,
  description,
  side,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  side?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start gap-2.5">
      <span className="grid size-[30px] shrink-0 place-items-center rounded-[9px] border border-violet-100 bg-violet-50 text-violet-700">
        <Icon aria-hidden="true" className="size-4" strokeWidth={1.85} />
      </span>
      <div className="min-w-0 flex-1 pt-px">
        <h2
          id={id}
          className="text-[14.5px] font-bold leading-tight tracking-[-0.015em] text-zinc-900"
        >
          {title}
        </h2>
        <p className="mt-0.5 text-[11px] leading-[1.45] text-zinc-500">
          {description}
        </p>
      </div>
      {side ? (
        <div className="ml-auto flex shrink-0 items-center gap-1.5 max-[380px]:ml-0 max-[380px]:w-full max-[380px]:pl-10">
          {side}
        </div>
      ) : null}
    </div>
  );
}

function MiniProfile({ dark }: { dark: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="absolute inset-0 flex flex-col items-center gap-[3px] pt-[9px]"
      style={{ color: dark ? "rgba(255,255,255,0.82)" : "rgba(24,24,27,0.66)" }}
    >
      <span className="mb-px size-[11px] rounded-full bg-current opacity-[0.78]" />
      <span className="h-[3px] w-[25px] rounded-full bg-current opacity-50" />
      <span className="h-[5px] w-[47px] rounded-[3px] bg-current opacity-25" />
      <span className="h-[5px] w-[39px] rounded-[3px] bg-current opacity-25" />
    </span>
  );
}

function AutoToggle({
  label,
  checked,
  colorKey,
  onChange,
}: {
  label: string;
  checked: boolean;
  colorKey: AppearanceColorKey;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={`Auto ${label.toLowerCase()} color`}
      title={
        checked
          ? "Use a custom color"
          : "Pick black or white automatically"
      }
      data-auto={colorKey}
      onClick={onChange}
      className="ml-auto inline-flex h-6 shrink-0 items-center gap-1.5 rounded-md px-0.5 text-[9.5px] font-bold uppercase tracking-[0.03em] text-zinc-500 transition hover:text-violet-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200 max-sm:h-8"
    >
      <span
        aria-hidden="true"
        className={cn(
          "relative block h-4 w-[27px] rounded-full bg-zinc-300 transition-colors",
          checked && "bg-violet-700",
        )}
      >
        <span
          className={cn(
            "absolute left-0.5 top-0.5 size-3 rounded-full bg-white shadow-sm transition-transform",
            checked && "translate-x-[11px]",
          )}
        />
      </span>
      Auto
    </button>
  );
}

function StyleTile({
  section,
  value,
  onSelect,
}: {
  section: StyleSection;
  value: string;
  onSelect: (value: string) => void;
}) {
  const Icon = section.icon;
  const current = section.options.find((option) => option.value === value);
  const optionIcon = Icon ? (
    <Icon aria-hidden="true" className="size-3.5" strokeWidth={1.9} />
  ) : (
    <span aria-hidden="true" className="text-[13px] font-bold tracking-[-0.04em]">
      Aa
    </span>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-style-key={section.key}
          aria-haspopup="listbox"
          className="flex min-h-[50px] min-w-0 items-center gap-[7px] rounded-[11px] border border-line bg-[#fdfcff] p-[7px] text-left transition hover:border-violet-200 hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200 data-[state=open]:border-violet-200 data-[state=open]:bg-white data-[state=open]:shadow-[0_0_0_3px_#f7f3ff] max-sm:min-h-[54px]"
        >
          <span className="grid size-[25px] shrink-0 place-items-center rounded-lg bg-violet-50 text-violet-700">
            {optionIcon}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[9.5px] font-semibold uppercase leading-tight tracking-[0.035em] text-zinc-400 max-sm:text-[10px]">
              {section.label}
            </span>
            <span className="mt-px block truncate text-xs font-semibold leading-tight text-zinc-700">
              {current?.label ?? value}
            </span>
          </span>
          <ChevronDown
            aria-hidden="true"
            className="size-[11px] shrink-0 text-zinc-400"
            strokeWidth={2}
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[244px] p-1.5" align="start">
        <DropdownMenuLabel className="px-1.5 py-1 text-[8px] tracking-[0.06em] text-zinc-400">
          {section.label}
        </DropdownMenuLabel>
        {section.options.map((option) => {
          const selected = option.value === value;
          return (
            <DropdownMenuItem
              key={option.value}
              data-option={option.value}
              onSelect={() => onSelect(option.value)}
              className={cn(
                "items-start gap-2 rounded-lg px-1.5 py-1.5 focus:bg-violet-50",
                selected && "bg-[#faf8ff]",
              )}
            >
              <span className="grid size-[25px] shrink-0 place-items-center rounded-[7px] bg-violet-50 text-violet-700">
                {Icon ? (
                  <Icon aria-hidden="true" className="size-[13px]" strokeWidth={1.9} />
                ) : (
                  <span aria-hidden="true" className="text-xs font-bold">
                    Aa
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[10.5px] font-semibold leading-tight text-zinc-700">
                  {option.label}
                </span>
                <span className="mt-px block text-[8.5px] leading-snug text-zinc-400">
                  {option.description}
                </span>
              </span>
              <Check
                aria-hidden="true"
                strokeWidth={2.6}
                className={cn(
                  "mt-1 size-3 shrink-0 text-violet-700",
                  selected ? "opacity-100" : "opacity-0",
                )}
              />
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ContentToggle({
  label,
  checked,
  value,
  onToggle,
}: {
  label: string;
  checked: boolean;
  value: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      data-visible={value}
      onClick={onToggle}
      className={cn(
        "flex min-h-10 min-w-0 items-center gap-2 rounded-[10px] border px-2.5 py-2 text-left text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200 max-sm:min-h-[44px] max-sm:text-[10.5px]",
        checked
          ? "border-[#e4dcfa] bg-[#faf8ff] text-violet-900"
          : "border-line bg-[#fdfcff] text-zinc-600 hover:border-violet-200 hover:bg-white",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "grid size-[17px] shrink-0 place-items-center rounded-[5px] border-[1.5px] transition",
          checked
            ? "border-violet-700 bg-violet-700 text-white"
            : "border-zinc-300 bg-white text-transparent",
        )}
      >
        <Check className="size-2.5" strokeWidth={3} />
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}

function ThemeSwapChip({
  preset,
  target,
}: {
  preset: ThemePresetDef;
  target: boolean;
}) {
  return (
    <span
      className={cn(
        "flex min-w-0 flex-1 items-center gap-2 rounded-lg border p-1.5",
        target
          ? "border-violet-200 bg-white shadow-[0_3px_10px_-6px_rgba(76,29,149,0.35)]"
          : "border-transparent",
      )}
    >
      <span
        aria-hidden="true"
        className="h-8 w-[42px] shrink-0 rounded-[7px] border border-zinc-900/10"
        style={{ background: preset.background }}
      />
      <span className="min-w-0">
        <span className="block truncate text-[10.5px] font-semibold text-zinc-700">
          {preset.name}
        </span>
        <span className="mt-px block text-[8.5px] text-zinc-400">
          {target ? "New look" : "Current look"}
        </span>
      </span>
    </span>
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
  const [undo, setUndo] = useState<{
    snapshot: AppearanceSettings;
    name: string;
  } | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [railEdges, setRailEdges] = useState({ prev: true, next: false });
  const railRef = useRef<HTMLDivElement>(null);
  const presetCancelRef = useRef<HTMLButtonElement>(null);
  const synced = useRef(false);

  const activePreset = themeFor(draft);
  const activePalette = presetPalette(activePreset);
  const palette = resolvedPalette(draft, activePreset);
  const dirty = JSON.stringify(draft) !== JSON.stringify(state.appearance);
  const invalidCount = invalidKeys.size;
  const hasChanges = dirty || invalidCount > 0;
  const customDesign = !isPresetExact(draft, activePreset);
  const customColors = colorsAreCustom(draft, activePreset);
  const allTextAuto = TEXT_COLOR_KEYS.every(
    (key) => storedColor(draft, key, activePalette) === AUTO_COLOR,
  );
  const saveState =
    invalidCount > 0
      ? `Fix ${invalidCount} ${invalidCount === 1 ? "color" : "colors"}`
      : dirty
        ? "Unsaved changes"
        : "All changes saved";
  const statusTone = invalidCount > 0 ? "error" : dirty ? "dirty" : "saved";

  const pendingPreset = presetTarget
    ? THEME_PRESETS.find((preset) => preset.id === presetTarget) ?? null
    : null;

  useEffect(() => {
    if (!hydrated || synced.current) return;
    const next = structuredClone(state.appearance);
    setDraft(next);
    setHexValues(hexValuesFor(next));
    setInvalidKeys(new Set());
    setUndo(null);
    synced.current = true;
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

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 96);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const updateRail = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const max = rail.scrollWidth - rail.clientWidth;
    setRailEdges({
      prev: rail.scrollLeft <= 8,
      next: rail.scrollLeft >= max - 8,
    });
  }, []);

  useEffect(() => {
    updateRail();
    const rail = railRef.current;
    if (!rail) return;
    const observer = new ResizeObserver(updateRail);
    observer.observe(rail);
    return () => observer.disconnect();
  }, [updateRail]);

  const applyDraft = (next: AppearanceSettings) => {
    setDraft(next);
    setHexValues(hexValuesFor(next));
  };

  const clearInvalid = (key?: AppearanceColorKey) => {
    setInvalidKeys((current) => {
      if (key === undefined) return current.size === 0 ? current : new Set();
      if (!current.has(key)) return current;
      const next = new Set(current);
      next.delete(key);
      return next;
    });
  };

  const markInvalid = (key: AppearanceColorKey) => {
    setInvalidKeys((current) => {
      if (current.has(key)) return current;
      const next = new Set(current);
      next.add(key);
      return next;
    });
  };

  const update = <Key extends keyof AppearanceSettings>(
    key: Key,
    value: AppearanceSettings[Key],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const updateStyle = (field: StyleField, value: string) => {
    setDraft((current) => ({ ...current, [field]: value } as AppearanceSettings));
  };

  const commitColor = (key: AppearanceColorKey, value: string) => {
    const next = withColor(draft, key, value, activePalette);
    applyDraft(next);
    clearInvalid(key);
  };

  const setAuto = (key: AppearanceColorKey) => {
    if (!COLOR_META[key].isText) return;
    const next = withColor(draft, key, AUTO_COLOR, activePalette);
    applyDraft(next);
    clearInvalid(key);
  };

  const toggleAuto = (key: AppearanceColorKey) => {
    const isAuto = storedColor(draft, key, activePalette) === AUTO_COLOR;
    // Turning Auto off keeps the colour it picked, so the user can adjust it.
    setAutoValue(key, isAuto ? palette[key] : AUTO_COLOR);
  };

  const setAutoValue = (key: AppearanceColorKey, value: string) => {
    const next = withColor(draft, key, value, activePalette);
    applyDraft(next);
    clearInvalid(key);
  };

  const onHexChange = (key: AppearanceColorKey, rawValue: string) => {
    setHexValues((current) => ({ ...current, [key]: rawValue }));

    const value = rawValue.trim();
    if (COLOR_META[key].isText && isAutoPrefix(value)) {
      clearInvalid(key);
      return;
    }

    const normalized = normalizeHexColor(value);
    const digits = value.replace(/^#/, "");
    if (!normalized || (digits.length !== 3 && digits.length !== 6)) {
      markInvalid(key);
      return;
    }

    clearInvalid(key);
    setDraft((current) =>
      withColor(
        current,
        key,
        normalized,
        presetPalette(themeFor(current)),
      ),
    );
  };

  const onHexBlur = (key: AppearanceColorKey) => {
    const value = hexValues[key].trim();

    if (COLOR_META[key].isText && isAutoPrefix(value)) {
      setAuto(key);
      return;
    }

    const normalized = normalizeHexColor(value);
    if (normalized) {
      const next = withColor(draft, key, normalized, activePalette);
      applyDraft(next);
      clearInvalid(key);
      return;
    }

    // Keep invalid input visible so the inline error explains what to fix.
    markInvalid(key);
  };

  const setAllTextAuto = () => {
    const next: AppearanceSettings = {
      ...draft,
      buttonTextColor: AUTO_COLOR,
      pageTextColor: AUTO_COLOR,
      titleColor: AUTO_COLOR,
    };
    applyDraft(next);
    for (const key of TEXT_COLOR_KEYS) clearInvalid(key);
  };

  const resetRow = (key: AppearanceColorKey) => {
    const next = withColor(draft, key, undefined, activePalette);
    applyDraft(next);
    clearInvalid(key);
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
    applyDraft(next);
    clearInvalid();
  };

  const applyPresetNow = (preset: ThemePresetDef) => {
    const previous = structuredClone(draft);
    const next = applyThemePreset(draft, preset, { force: true });
    applyDraft(next);
    clearInvalid();
    setPresetTarget(null);
    setUndo({ snapshot: previous, name: preset.name });
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
    applyPresetNow(pendingPreset);
  };

  const undoLast = () => {
    if (!undo) return;
    applyDraft(structuredClone(undo.snapshot));
    setInvalidKeys(new Set());
    setUndo(null);
  };

  const focusFirstInvalid = () => {
    const key = APPEARANCE_COLOR_KEYS.find((candidate) =>
      invalidKeys.has(candidate),
    );
    if (!key) return;
    const input = document.querySelector<HTMLInputElement>(
      `[data-color-input="${key}"]`,
    );
    input?.scrollIntoView({ block: "center", behavior: "smooth" });
    input?.focus();
    input?.select();
  };

  const saveDraft = async () => {
    if (!hasChanges) return;
    if (invalidCount > 0) {
      focusFirstInvalid();
      return;
    }
    const ok = await setAppearance(draft);
    if (ok) setUndo(null);
  };

  const discardDraft = () => {
    if (!hasChanges) return;
    const next = structuredClone(state.appearance);
    applyDraft(next);
    clearInvalid();
    setUndo(null);
  };

  const resetDraft = () => {
    const previous = structuredClone(draft);
    const next = defaultAppearance();
    applyDraft(next);
    clearInvalid();
    setResetOpen(false);
    setUndo({ snapshot: previous, name: "Default appearance" });
  };

  const scrollRail = (direction: -1 | 1) => {
    railRef.current?.scrollBy({
      left: direction * Math.max(320, railRef.current.clientWidth * 0.8),
      behavior: "smooth",
    });
  };

  return (
    <DashboardFrame
      className="pb-28 sm:pb-24"
      preview={
        <AppearancePreview
          appearance={draft}
          profile={state.profile}
          categories={state.categories}
          links={state.links}
          dirty={hasChanges}
        />
      }
      previewClassName="min-[1400px]:block"
    >
      <div className="mx-auto w-full max-w-[900px]">
        <header className="mb-2.5 flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <span className="grid size-[38px] shrink-0 place-items-center rounded-[11px] bg-gradient-to-br from-violet-500 to-violet-800 text-white shadow-[0_10px_22px_-12px_rgba(91,33,182,0.75)] max-sm:size-[34px]">
              <Palette aria-hidden="true" className="size-[19px] max-sm:size-[17px]" strokeWidth={1.8} />
            </span>
            <div className="min-w-0 pt-px">
              <h1 className="text-[23px] font-bold leading-[1.12] tracking-[-0.035em] text-zinc-900 sm:text-[25px]">
                Appearance
              </h1>
              <p className="mt-1 max-w-[430px] text-[11.5px] leading-[1.45] text-zinc-500 sm:text-xs">
                Make it yours. Preview live, then save when you&apos;re ready.
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 sm:hidden">
                <StatusPill
                  label={saveState}
                  tone={statusTone}
                  testId="appearance-status-mobile"
                  className="h-7 px-2 text-[10px]"
                />
                <button
                  type="button"
                  data-testid="appearance-preview-mobile"
                  onClick={() => setPreviewOpen(true)}
                  className="inline-flex h-7 items-center gap-1 rounded-full border border-line-strong bg-white px-2.5 text-[10px] font-semibold text-violet-800 transition hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200"
                >
                  <Eye aria-hidden="true" className="size-3" strokeWidth={2.1} />
                  Preview
                </button>
              </div>
            </div>
          </div>

          <div className="ml-auto hidden shrink-0 items-center gap-2 self-start pt-1 sm:flex">
            <StatusPill
              label={saveState}
              tone={statusTone}
              testId="appearance-status-header"
            />
            <Button
              variant="secondary"
              size="icon"
              data-testid="appearance-preview-header"
              onClick={() => setPreviewOpen(true)}
              aria-label="Open live preview"
              title="Live preview"
              className="min-[1400px]:hidden"
            >
              <Eye aria-hidden="true" className="size-4" />
            </Button>
            <Button
              variant="secondary"
              data-testid="appearance-discard"
              onClick={discardDraft}
              disabled={!hasChanges || pending !== null}
            >
              Discard
            </Button>
            <Button
              data-testid="appearance-save"
              onClick={() => void run("save", saveDraft)}
              disabled={!hasChanges || pending !== null}
              loading={pending === "save"}
            >
              <Check aria-hidden="true" className="size-4" strokeWidth={2.2} />
              Save changes
            </Button>
          </div>
        </header>

        <div className="space-y-2">
          <Card className="rounded-[15px] p-3.5 shadow-card max-sm:p-3.5">
            <section aria-labelledby="appearance-theme">
              <SectionHeader
                id="appearance-theme"
                icon={Sparkles}
                title="Theme"
                description="Start with a preset, then fine-tune below."
                side={
                  customDesign ? (
                    <span
                      data-testid="theme-custom"
                      className="inline-flex h-6 max-w-full items-center gap-1.5 truncate whitespace-nowrap rounded-full border border-line-strong bg-violet-50 px-2 text-[10.5px] font-semibold text-violet-800 max-sm:h-[23px] max-sm:text-[9.5px]"
                    >
                      <span aria-hidden="true" className="size-1 shrink-0 rounded-full bg-violet-500" />
                      <span className="truncate">
                        Custom (based on {activePreset.name})
                      </span>
                    </span>
                  ) : (
                    <span
                      data-testid="theme-exact"
                      className="inline-flex h-6 max-w-full items-center gap-1.5 truncate whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-2 text-[10.5px] font-semibold text-emerald-700 max-sm:h-[23px] max-sm:text-[9.5px]"
                    >
                      <span aria-hidden="true" className="size-1 shrink-0 rounded-full bg-emerald-500" />
                      <span className="truncate">
                        {activePreset.name} selected
                      </span>
                    </span>
                  )
                }
              />

              {undo ? (
                <div
                  data-testid="appearance-undo"
                  role="status"
                  className="mt-2.5 flex items-center gap-1.5 rounded-[9px] border border-line-strong bg-violet-50 px-2 py-1.5 text-[10.5px] leading-snug text-violet-800"
                >
                  <Check aria-hidden="true" className="size-3.5 shrink-0 text-violet-700" strokeWidth={2.2} />
                  <span className="min-w-0">
                    <strong className="font-bold">{undo.name} applied.</strong>{" "}
                    <span className="text-violet-500">Save to keep it.</span>
                  </span>
                  <button
                    type="button"
                    data-undo=""
                    onClick={undoLast}
                    className="ml-auto shrink-0 rounded text-[10.5px] font-bold text-violet-800 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200"
                  >
                    Undo
                  </button>
                  <button
                    type="button"
                    data-undo-close=""
                    onClick={() => setUndo(null)}
                    aria-label="Dismiss"
                    className="grid size-[22px] shrink-0 place-items-center rounded-[5px] text-violet-400 transition hover:bg-violet-100 hover:text-violet-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200"
                  >
                    <X aria-hidden="true" className="size-3" />
                  </button>
                </div>
              ) : null}

              <div className="relative mt-2.5">
                <button
                  type="button"
                  onClick={() => scrollRail(-1)}
                  disabled={railEdges.prev}
                  aria-label="Scroll themes left"
                  className="absolute -left-2 top-[25px] z-10 hidden size-7 place-items-center rounded-full border border-[#e9e5f5] bg-white text-zinc-600 shadow-[0_5px_14px_-6px_rgba(24,24,27,0.28)] transition hover:bg-violet-50 hover:text-violet-800 disabled:pointer-events-none disabled:opacity-0 sm:grid"
                >
                  <ChevronLeft aria-hidden="true" className="size-3.5" strokeWidth={2.1} />
                </button>
                <div
                  ref={railRef}
                  onScroll={updateRail}
                  aria-label="Theme presets"
                  className="no-scrollbar flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth px-1 pb-1 pt-1.5"
                >
                  {THEME_PRESETS.map((preset) => {
                    const presetId = preset.id as ThemeId;
                    const selected = draft.theme === presetId;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        data-preset={preset.id}
                        aria-pressed={selected}
                        onClick={() => choosePreset(preset)}
                        title={`${preset.name} — ${PRESET_DESCRIPTIONS[presetId]}`}
                        className="group w-24 shrink-0 snap-start text-left focus-visible:outline-none sm:w-[106px]"
                      >
                        <span
                          className={cn(
                            "relative block h-[54px] overflow-hidden rounded-[11px] border border-zinc-900/10 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18),0_3px_8px_-6px_rgba(24,24,27,0.35)] transition group-hover:-translate-y-0.5 group-hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18),0_10px_18px_-12px_rgba(24,24,27,0.4)]",
                            selected &&
                              "ring-2 ring-violet-700 ring-offset-2",
                          )}
                          style={{ background: preset.background }}
                        >
                          <MiniProfile dark={preset.dark} />
                          {selected ? (
                            <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full border-2 border-white bg-violet-700 text-white shadow-[0_2px_5px_rgba(24,24,27,0.18)]">
                              <Check aria-hidden="true" className="size-2" strokeWidth={3.4} />
                            </span>
                          ) : null}
                        </span>
                        <span
                          className={cn(
                            "mt-1.5 block truncate text-[11.5px] font-semibold leading-tight",
                            selected ? "text-violet-800" : "text-zinc-600",
                          )}
                        >
                          {preset.name}
                        </span>
                        <span
                          className={cn(
                            "mt-0.5 block truncate text-[10px] leading-tight max-sm:text-[10.5px]",
                            selected ? "text-violet-500" : "text-zinc-400",
                          )}
                        >
                          {PRESET_DESCRIPTIONS[presetId]}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => scrollRail(1)}
                  disabled={railEdges.next}
                  aria-label="Scroll themes right"
                  className="absolute -right-2 top-[25px] z-10 hidden size-7 place-items-center rounded-full border border-[#e9e5f5] bg-white text-zinc-600 shadow-[0_5px_14px_-6px_rgba(24,24,27,0.28)] transition hover:bg-violet-50 hover:text-violet-800 disabled:pointer-events-none disabled:opacity-0 sm:grid"
                >
                  <ChevronRight aria-hidden="true" className="size-3.5" strokeWidth={2.1} />
                </button>
              </div>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-1.5 text-[10.5px] leading-snug text-zinc-400 max-sm:mt-2 max-sm:gap-1.5 max-sm:text-[10.2px]">
                <span>Presets also set typography, corners and button style.</span>
                <button
                  type="button"
                  onClick={() => setResetOpen(true)}
                  disabled={pending !== null}
                  className="rounded text-[10.5px] font-semibold text-violet-700 underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:text-zinc-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200"
                >
                  Reset all appearance settings
                </button>
              </div>
            </section>
          </Card>

          <Card className="rounded-[15px] p-3.5 shadow-card">
            <section aria-labelledby="appearance-colors">
              <SectionHeader
                id="appearance-colors"
                icon={Palette}
                title="Colors"
                description="Five colors shape your page."
                side={
                  <button
                    type="button"
                    data-auto-all=""
                    onClick={setAllTextAuto}
                    disabled={allTextAuto}
                    title="Set all three text colors to Auto"
                    className="inline-flex h-[26px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-line-strong bg-white px-2 text-[10.5px] font-semibold text-violet-800 transition hover:border-violet-200 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200 max-sm:h-7 max-sm:text-[10px]"
                  >
                    <Sparkles aria-hidden="true" className="size-3" strokeWidth={2} />
                    Auto all text
                  </button>
                }
              />

              <div className="mt-2.5 grid grid-cols-1 gap-2 min-[640px]:grid-cols-2 min-[900px]:grid-cols-6">
                {APPEARANCE_COLOR_KEYS.map((key) => {
                  const meta = COLOR_META[key];
                  const value = storedColor(draft, key, activePalette);
                  const isAuto = value === AUTO_COLOR;
                  const custom =
                    !isAuto && !sameColor(value, activePalette[key]);
                  const invalid = invalidKeys.has(key);
                  const ratio = paletteContrast(key, draft, activePreset);
                  const warning =
                    !isAuto &&
                    !invalid &&
                    ratio !== null &&
                    ratio < 4.5 &&
                    (key !== "buttonText" || draft.button === "brand");
                  const note =
                    key === "background"
                      ? BACKGROUND_NOTES[draft.background]
                      : meta.note;
                  const canReset = custom || isAuto || invalid;

                  return (
                    <article
                      key={key}
                      data-color-row={key}
                      className={cn(
                        "min-w-0 rounded-xl border border-line bg-[#fdfcff] p-2.5 transition hover:border-violet-200 hover:bg-white hover:shadow-[0_10px_26px_-24px_rgba(76,29,149,0.5)] max-sm:p-[11px]",
                        (key === "background" || key === "buttons") &&
                          "min-[900px]:col-span-3",
                        (key === "buttonText" ||
                          key === "pageText" ||
                          key === "title") &&
                          "min-[900px]:col-span-2",
                        key === "title" && "min-[640px]:col-span-2 min-[900px]:col-span-2",
                      )}
                    >
                      <div className="flex min-h-5 flex-wrap items-center gap-1.5">
                        <span className="whitespace-nowrap text-xs font-semibold tracking-[-0.01em] text-zinc-800">
                          {meta.label}
                        </span>
                        {custom ? (
                          <span className="inline-flex h-[15px] items-center rounded-full border border-violet-200 bg-violet-100 px-1 text-[9px] font-bold uppercase leading-none tracking-[0.04em] text-violet-700">
                            Custom
                          </span>
                        ) : null}
                        {meta.isText ? (
                          <AutoToggle
                            label={meta.label}
                            checked={isAuto}
                            colorKey={key}
                            onChange={() => toggleAuto(key)}
                          />
                        ) : (
                          <span aria-hidden="true" className="ml-auto" />
                        )}
                        {canReset ? (
                          <button
                            type="button"
                            data-reset-color={key}
                            onClick={() => resetRow(key)}
                            aria-label={`Reset ${meta.label.toLowerCase()} to ${activePreset.name}`}
                            title={`Reset to ${activePreset.name}`}
                            className="grid size-[22px] shrink-0 place-items-center rounded-md text-zinc-400 transition hover:bg-violet-50 hover:text-violet-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200 max-sm:size-8"
                          >
                            <RotateCcw aria-hidden="true" className="size-3" strokeWidth={2} />
                          </button>
                        ) : null}
                      </div>

                      <div className="mt-1 flex items-center gap-1.5 max-sm:mt-2 max-sm:gap-2">
                        <label
                          className="relative block size-[29px] shrink-0 cursor-pointer rounded-lg border border-zinc-900/15 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.22),0_2px_5px_-2px_rgba(24,24,27,0.18)] transition hover:-translate-y-px hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.22),0_5px_9px_-4px_rgba(24,24,27,0.25)] focus-within:ring-4 focus-within:ring-violet-100 max-sm:size-9 max-sm:rounded-[9px]"
                          style={{
                            background:
                              key === "background"
                                ? backgroundFor(draft, activePreset)
                                : palette[key],
                          }}
                          title={`Pick ${meta.label.toLowerCase()} color`}
                        >
                          <input
                            type="color"
                            data-color-picker={key}
                            value={
                              normalizeHexColor(palette[key])?.toLowerCase() ??
                              "#000000"
                            }
                            onChange={(event) =>
                              commitColor(key, event.target.value)
                            }
                            aria-label={`Choose ${meta.label.toLowerCase()} color`}
                            className="absolute inset-0 size-full cursor-pointer opacity-0"
                          />
                        </label>

                        <label
                          className={cn(
                            "flex h-[29px] min-w-0 flex-1 items-center gap-px rounded-lg border px-2 transition max-sm:h-9 max-sm:px-2.5",
                            isAuto
                              ? "border-[#e8e3f3] bg-violet-50/70"
                              : "border-[#e8e3f3] bg-[#faf9ff] hover:border-[#d8d0eb]",
                            invalid
                              ? "border-red-300 bg-white ring-4 ring-red-100"
                              : "focus-within:border-violet-200 focus-within:bg-white focus-within:ring-4 focus-within:ring-violet-100",
                          )}
                        >
                          {!isAuto ? (
                            <span
                              aria-hidden="true"
                              className="shrink-0 font-mono text-[10.5px] text-zinc-400"
                            >
                              #
                            </span>
                          ) : null}
                          <input
                            data-color-input={key}
                            value={hexValues[key]}
                            onChange={(event) =>
                              onHexChange(key, event.target.value)
                            }
                            onBlur={() => onHexBlur(key)}
                            onFocus={(event) => {
                              if (event.currentTarget.value.startsWith("Auto")) {
                                event.currentTarget.select();
                              }
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.currentTarget.blur();
                              }
                            }}
                            maxLength={14}
                            spellCheck={false}
                            autoComplete="off"
                            aria-label={`${meta.label} color value`}
                            aria-invalid={invalid || undefined}
                            aria-describedby={
                              invalid ? `${key}-error` : undefined
                            }
                            className={cn(
                              "min-w-0 flex-1 bg-transparent outline-none",
                              isAuto
                                ? "text-[10.5px] font-semibold text-violet-800"
                                : "font-mono text-[11px] font-semibold uppercase tracking-[0.035em] text-zinc-600",
                              "max-sm:text-xs",
                            )}
                          />
                        </label>
                      </div>

                      <div className="mt-1 flex min-h-[15px] items-center gap-1.5 overflow-hidden max-sm:mt-1.5 max-sm:min-h-[19px]">
                        {invalid ? (
                          <span
                            id={`${key}-error`}
                            className="truncate text-[9.5px] font-semibold text-red-700 max-sm:text-[10.5px]"
                          >
                            Use a 3 or 6 digit hex value.
                          </span>
                        ) : warning ? (
                          <>
                            <span
                              title={`Contrast ${ratio.toFixed(1)}:1 — WCAG AA needs 4.5:1 for normal text.`}
                              className="inline-flex min-w-0 cursor-help items-center gap-1 whitespace-nowrap text-[9.5px] font-semibold text-amber-700 max-sm:text-[10.5px]"
                            >
                              <AlertTriangle aria-hidden="true" className="size-2.5 shrink-0 text-amber-600" strokeWidth={2} />
                              <span className="truncate">
                                Low contrast {ratio.toFixed(1)}:1
                              </span>
                            </span>
                            <button
                              type="button"
                              data-use-auto={key}
                              onClick={() => setAuto(key)}
                              className="ml-auto h-[18px] shrink-0 rounded border border-amber-300 bg-amber-50 px-1.5 text-[9px] font-bold text-amber-800 transition hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200 max-sm:h-8 max-sm:px-2.5 max-sm:text-[10px]"
                            >
                              Use Auto
                            </button>
                          </>
                        ) : (
                          <span className="truncate text-[10.3px] text-zinc-400 max-sm:text-[10.5px]">
                            {note}
                          </span>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-1.5 text-[10.5px] leading-snug text-zinc-400 max-sm:gap-1.5">
                <span>Auto picks pure black or white for the best contrast.</span>
                <button
                  type="button"
                  data-reset-colors=""
                  onClick={resetColors}
                  disabled={!customColors}
                  className="rounded text-[10.5px] font-semibold text-violet-700 underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:text-zinc-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200"
                >
                  Reset colors to {activePreset.name}
                </button>
              </div>
            </section>
          </Card>

          <Card className="rounded-[15px] p-3.5 shadow-card">
            <section aria-labelledby="appearance-style">
              <SectionHeader
                id="appearance-style"
                icon={SlidersHorizontal}
                title="Style & layout"
                description="Tune the shape and feel of your page."
              />
              <div className="mt-2.5 grid grid-cols-2 gap-[7px] min-[900px]:grid-cols-5">
                {STYLE_SECTIONS.map((section) => (
                  <div
                    key={section.key}
                    className={cn(
                      "min-w-0",
                      section.key === "font" &&
                        "col-span-2 min-[900px]:col-span-1",
                    )}
                  >
                    <StyleTile
                      section={section}
                      value={draft[section.key]}
                      onSelect={(value) => updateStyle(section.key, value)}
                    />
                  </div>
                ))}
              </div>
            </section>
          </Card>

          <Card className="rounded-[15px] p-3.5 shadow-card">
            <section aria-labelledby="appearance-content">
              <SectionHeader
                id="appearance-content"
                icon={Eye}
                title="Content"
                description="Choose what appears on your public page."
              />
              <div className="mt-2.5 grid grid-cols-2 gap-[7px] min-[768px]:grid-cols-4">
                {TOGGLES.map((toggle) => (
                  <ContentToggle
                    key={toggle.key}
                    label={toggle.label}
                    value={toggle.key}
                    checked={draft[toggle.key]}
                    onToggle={() => update(toggle.key, !draft[toggle.key])}
                  />
                ))}
              </div>
            </section>
          </Card>
        </div>
      </div>

      {hasChanges ? (
        <div
          data-testid="appearance-savebar"
          role="region"
          aria-label="Unsaved appearance changes"
          className={cn(
            "fixed inset-x-0 bottom-0 z-40 flex items-center gap-2 border-t border-line bg-white/95 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-14px_34px_-22px_rgba(76,29,149,0.45)] backdrop-blur sm:inset-x-auto sm:bottom-5 sm:left-1/2 sm:right-auto sm:w-[min(620px,calc(100vw-3rem))] sm:-translate-x-1/2 sm:gap-2.5 sm:rounded-2xl sm:border sm:px-2.5 sm:pb-2 sm:pt-2 lg:left-[calc(50%+7.5rem)] min-[1400px]:left-[calc(50%-3.75rem)] sm:transition-all sm:duration-200 sm:ease-out",
            scrolled
              ? "sm:visible sm:translate-y-0 sm:opacity-100"
              : "sm:invisible sm:pointer-events-none sm:translate-y-3 sm:opacity-0",
          )}
        >
          <StatusPill
            label={saveState}
            tone={statusTone}
            testId="appearance-status-savebar"
            className="h-[25px] px-2 text-[10px] max-sm:h-7 max-sm:px-2 max-sm:text-[9.5px] max-[380px]:px-1.5 max-[380px]:text-[9px]"
          />
          <span className="hidden whitespace-nowrap text-[9.5px] text-zinc-400 sm:inline">
            Preview updates live
          </span>
          <div className="ml-auto flex items-center gap-1.5 max-sm:gap-1">
            <button
              type="button"
              data-testid="appearance-preview-savebar"
              onClick={() => setPreviewOpen(true)}
              aria-label="Open live preview"
              title="Live preview"
              className="grid size-[30px] shrink-0 place-items-center rounded-lg border border-zinc-200 bg-white text-violet-800 transition hover:bg-violet-50 hover:border-violet-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200 max-sm:size-[34px] min-[1400px]:hidden"
            >
              <Eye aria-hidden="true" className="size-[15px]" strokeWidth={2} />
            </button>
            <Button
              variant="secondary"
              size="sm"
              data-testid="appearance-savebar-discard"
              onClick={discardDraft}
              disabled={!hasChanges || pending !== null}
              className="max-sm:h-[34px] max-sm:px-2.5 max-sm:text-[11px] max-[380px]:px-2 max-[380px]:text-[10px]"
            >
              Discard
            </Button>
            <Button
              size="sm"
              data-testid="appearance-savebar-save"
              onClick={() => void run("save", saveDraft)}
              disabled={!hasChanges || pending !== null}
              loading={pending === "save"}
              className="max-sm:h-[34px] max-sm:px-2.5 max-sm:text-[11px] max-[380px]:px-2 max-[380px]:text-[10px]"
            >
              <Check aria-hidden="true" className="size-3" strokeWidth={2.2} />
              Save changes
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="appearance-preview-dialog max-w-[380px] p-4 max-sm:max-w-none">
          <DialogHeader className="mb-3">
            <DialogTitle>Live preview</DialogTitle>
            <DialogDescription>
              See how your public page looks with these settings.
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
          <Button
            variant="secondary"
            onClick={() => setPreviewOpen(false)}
            className="mt-3 w-full"
          >
            Close preview
          </Button>
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
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-[10px] border border-amber-200 bg-amber-50 text-amber-700">
                <AlertTriangle aria-hidden="true" className="size-[18px]" strokeWidth={1.9} />
              </span>
              <div>
                <DialogTitle>
                  {pendingPreset?.id === draft.theme
                    ? "Reset your custom colors?"
                    : "Replace your custom colors?"}
                </DialogTitle>
                <DialogDescription className="mt-1">
                  {pendingPreset?.id === draft.theme ? (
                    <>
                      This will reset your palette and style options to the{" "}
                      <strong className="font-semibold text-zinc-700">
                        {pendingPreset?.name}
                      </strong>{" "}
                      preset. You can undo right after.
                    </>
                  ) : (
                    <>
                      Applying{" "}
                      <strong className="font-semibold text-zinc-700">
                        {pendingPreset?.name}
                      </strong>{" "}
                      will replace all five colors and the style options. You can
                      undo right after.
                    </>
                  )}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {pendingPreset ? (
            <>
              <div className="flex items-center gap-1.5 rounded-xl border border-line bg-[#fbfaff] p-2.5">
                <ThemeSwapChip preset={activePreset} target={false} />
                <ChevronRight
                  aria-hidden="true"
                  className="size-4 shrink-0 text-zinc-400"
                />
                <ThemeSwapChip preset={pendingPreset} target />
              </div>
              <p className="mt-3 flex items-start gap-1.5 text-[9.5px] leading-relaxed text-zinc-400">
                <Check
                  aria-hidden="true"
                  className="mt-0.5 size-3 shrink-0 text-zinc-400"
                />
                Your preview updates immediately. Nothing is saved until you
                choose Save changes.
              </p>
            </>
          ) : null}

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
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-[10px] border border-line-strong bg-violet-50 text-violet-700">
                <SlidersHorizontal
                  aria-hidden="true"
                  className="size-[18px]"
                  strokeWidth={1.9}
                />
              </span>
              <div>
                <DialogTitle>Reset all appearance settings?</DialogTitle>
                <DialogDescription className="mt-1">
                  This restores the default preset, all five colors, style
                  options and content visibility. Your unsaved choices will be
                  discarded.
                </DialogDescription>
              </div>
            </div>
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
