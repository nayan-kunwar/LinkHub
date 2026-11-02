"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import type { AppearanceSettings, ThemeId } from "@linkhub/shared";
import {
  BACKGROUND_STYLES,
  BUTTON_STYLES,
  CARD_STYLES,
  COLOR_PALETTE,
  FONT_CHOICES,
  PROFILE_LAYOUTS,
  THEME_PRESETS,
} from "@linkhub/shared";
import { DashboardFrame } from "@/components/dashboard-frame";
import { DashboardPreview } from "@/components/dashboard-preview";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
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
  CARD_RADII,
  FONT_STACK,
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

const TOGGLES = [
  { key: "showAvatar", label: "Show profile picture" },
  { key: "showBio", label: "Show bio" },
  { key: "showSocial", label: "Show social icons" },
  { key: "showDescription", label: "Show link descriptions" },
] as const;

function defaultAppearance(): AppearanceSettings {
  return structuredClone(DEFAULT_APPEARANCE);
}

export function AppearanceView() {
  const { state, hydrated, setAppearance } = useAppData();
  const { pending, run } = usePendingAction();
  const [draft, setDraft] = useState<AppearanceSettings>(() => structuredClone(state.appearance));
  const [resetTarget, setResetTarget] = useState<"preset" | "default" | null>(null);

  useEffect(() => {
    if (hydrated) setDraft(structuredClone(state.appearance));
  }, [hydrated, state.appearance]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(state.appearance);
  const currentPresetName =
    THEME_PRESETS.find((preset) => preset.id === draft.theme)?.name ?? "this preset";

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const update = <Key extends keyof AppearanceSettings>(
    key: Key,
    value: AppearanceSettings[Key],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const applyPreset = (id: ThemeId) => {
    const preset = THEME_PRESETS.find((candidate) => candidate.id === id);
    if (!preset) return;
    setDraft((current) => applyThemePreset(current, preset));
  };

  const resetToPreset = () => {
    const preset = THEME_PRESETS.find((candidate) => candidate.id === draft.theme);
    if (!preset) return;
    setDraft((current) => applyThemePreset(current, preset, { force: true }));
    setResetTarget(null);
    toast.info("Preset values restored — save to apply");
  };

  const saveDraft = async () => {
    const ok = await setAppearance(draft);
    if (ok) toast.success("Appearance saved");
  };

  const resetDraft = () => {
    setDraft(defaultAppearance());
    setResetTarget(null);
    toast.info("Reset to default — save to apply");
  };

  return (
    <DashboardFrame preview={<DashboardPreview title="Live preview" appearanceOverride={draft} />}>
      <PageHeader
        title="Appearance"
        description="Customize how your public profile looks. Changes preview live and apply when you save."
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
              variant="secondary"
              onClick={() => setResetTarget("default")}
              disabled={pending !== null}
            >
              Reset to default
            </Button>
            <Button
              onClick={() => {
                void run("save", saveDraft);
              }}
              disabled={!dirty || pending !== null}
              loading={pending === "save"}
            >
              Save
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <Card className="p-5">
            <section aria-labelledby="appearance-theme">
              <h2 id="appearance-theme" className="font-bold text-zinc-900">
                Theme
              </h2>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-zinc-700">
                  Pick a preset, then fine-tune colors and background.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setResetTarget("preset")}
                  disabled={pending !== null}
                >
                  Reset to preset
                </Button>
              </div>
              <div
                className="grid grid-cols-2 gap-3 sm:grid-cols-4"
                role="radiogroup"
                aria-labelledby="appearance-theme"
              >
                {THEME_PRESETS.map((preset) => (
                  <label key={preset.id} className="cursor-pointer">
                    <input
                      type="radio"
                      name="appearance-theme"
                      value={preset.id}
                      checked={draft.theme === preset.id}
                      onChange={() => applyPreset(preset.id)}
                      className="peer sr-only"
                    />
                    <span className="block rounded-xl border-2 border-zinc-200 bg-white p-2 text-center text-xs font-semibold text-zinc-700 transition peer-checked:border-violet-700 peer-checked:ring-2 peer-checked:ring-violet-100 peer-focus-visible:ring-4 peer-focus-visible:ring-violet-200">
                      <span
                        className="block h-16 rounded-lg border border-zinc-200"
                        style={{ background: preset.background }}
                      />
                      <span className="mt-1.5 block">{preset.name}</span>
                    </span>
                  </label>
                ))}
              </div>
            </section>
          </Card>

          <Card className="p-5">
            <section aria-labelledby="appearance-color">
              <h2 id="appearance-color" className="font-bold text-zinc-900">
                Primary color
              </h2>
              <p className="mb-3 text-sm text-zinc-700">
                Used for icons, outlines and accents.
              </p>
              <div
                className="flex flex-wrap items-center gap-3"
                role="radiogroup"
                aria-labelledby="appearance-color"
              >
                {COLOR_PALETTE.map((color) => {
                  const selected = draft.color.toLowerCase() === color.toLowerCase();
                  return (
                    <label key={color} className="cursor-pointer" aria-label={`Primary color ${color}`}>
                      <input
                        type="radio"
                        name="appearance-color"
                        value={color}
                        checked={selected}
                        onChange={() => update("color", color)}
                        className="peer sr-only"
                      />
                      <span
                        className="flex size-9 items-center justify-center rounded-full ring-offset-2 transition peer-checked:ring-2 peer-checked:ring-violet-700 peer-focus-visible:ring-4 peer-focus-visible:ring-violet-200"
                        style={{ backgroundColor: color }}
                      >
                        {selected ? (
                          <Check
                            aria-hidden="true"
                            className="size-4 text-white drop-shadow"
                            strokeWidth={3}
                          />
                        ) : null}
                      </span>
                    </label>
                  );
                })}
                <label className="ml-1 flex items-center gap-2 text-sm font-medium text-zinc-700">
                  Custom
                  <input
                    type="color"
                    value={draft.color}
                    onChange={(event) => update("color", event.target.value)}
                    aria-label="Custom primary color"
                    className="size-9 cursor-pointer rounded-lg border border-zinc-300 bg-white p-0.5"
                  />
                  <span className="font-mono text-[11px] uppercase text-zinc-500">{draft.color}</span>
                </label>
              </div>
            </section>
          </Card>

          <Card className="p-5">
            <section aria-labelledby="appearance-background">
              <h2 id="appearance-background" className="font-bold text-zinc-900">
                Background
              </h2>
              <p className="mb-3 text-sm text-zinc-700">Choose a background style.</p>
              <div
                className="grid grid-cols-3 gap-3 sm:grid-cols-5"
                role="radiogroup"
                aria-labelledby="appearance-background"
              >
                {BACKGROUND_STYLES.map((background) => (
                  <label key={background} className="cursor-pointer">
                    <input
                      type="radio"
                      name="appearance-background"
                      value={background}
                      checked={draft.background === background}
                      onChange={() => update("background", background)}
                      className="peer sr-only"
                    />
                    <span className="block rounded-xl border-2 border-zinc-200 bg-white p-2 text-center text-xs font-semibold text-zinc-700 transition peer-checked:border-violet-700 peer-checked:ring-2 peer-checked:ring-violet-100 peer-focus-visible:ring-4 peer-focus-visible:ring-violet-200">
                      <span
                        className="block h-14 rounded-lg border border-zinc-200"
                        style={{
                          background: backgroundFor({ ...draft, background }),
                        }}
                      />
                      <span className="mt-1.5 block">{BACKGROUND_LABELS[background]}</span>
                    </span>
                  </label>
                ))}
                <div
                  aria-disabled="true"
                  className="cursor-not-allowed rounded-xl border-2 border-zinc-200 bg-white p-2 text-center text-xs font-semibold text-zinc-500 opacity-70"
                >
                  <span
                    className="block h-14 rounded-lg border border-zinc-200"
                    style={{
                      background:
                        "repeating-linear-gradient(45deg,#e4e4e7 0 6px,#f4f4f5 6px 12px)",
                    }}
                  />
                  <span className="mt-1.5 flex items-center justify-center gap-1">
                    Image <Badge variant="later">LATER</Badge>
                  </span>
                </div>
              </div>
            </section>
          </Card>

          <Card className="p-5">
            <section aria-labelledby="appearance-layout">
              <h2 id="appearance-layout" className="font-bold text-zinc-900">
                Layout
              </h2>
              <p className="mb-3 text-sm text-zinc-700">
                Group links under category headings, or show one simple list.
              </p>
              <div
                className="grid grid-cols-2 gap-3"
                role="radiogroup"
                aria-labelledby="appearance-layout"
              >
                {PROFILE_LAYOUTS.map((layout) => (
                  <label key={layout} className="cursor-pointer">
                    <input
                      type="radio"
                      name="appearance-layout"
                      value={layout}
                      checked={draft.layout === layout}
                      onChange={() => update("layout", layout)}
                      className="peer sr-only"
                    />
                    <span className="block rounded-xl border-2 border-zinc-200 bg-white p-2 text-center text-xs font-semibold text-zinc-700 transition peer-checked:border-violet-700 peer-checked:bg-violet-50 peer-focus-visible:ring-4 peer-focus-visible:ring-violet-200">
                      <span className="mx-auto block h-16 w-full rounded-lg border border-zinc-200 bg-zinc-50 p-2">
                        {layout === "grouped" ? (
                          <span className="flex h-full flex-col justify-center gap-1">
                            <span className="mx-auto block h-1.5 w-8 rounded bg-violet-300" />
                            <span className="block h-2.5 w-full rounded bg-violet-100" />
                            <span className="block h-2.5 w-full rounded bg-violet-100" />
                          </span>
                        ) : (
                          <span className="flex h-full flex-col justify-center gap-1">
                            <span className="block h-2.5 w-full rounded bg-violet-100" />
                            <span className="block h-2.5 w-full rounded bg-violet-100" />
                            <span className="block h-2.5 w-full rounded bg-violet-100" />
                          </span>
                        )}
                      </span>
                      <span className="mt-1.5 block">{LAYOUT_LABELS[layout]}</span>
                    </span>
                  </label>
                ))}
              </div>
            </section>
          </Card>
        </div>

        <Card className="h-fit p-5">
          <section aria-labelledby="appearance-other" className="space-y-5">
            <h2 id="appearance-other" className="font-bold text-zinc-900">
              Other settings
            </h2>

            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-zinc-800">Font</legend>
              <div className="grid grid-cols-2 gap-2">
                {FONT_CHOICES.map((font) => (
                  <label key={font} className="cursor-pointer">
                    <input
                      type="radio"
                      name="appearance-font"
                      value={font}
                      checked={draft.font === font}
                      onChange={() => update("font", font)}
                      className="peer sr-only"
                    />
                    <span className="block rounded-lg border-2 border-zinc-200 bg-white p-2 text-center text-xs font-semibold text-zinc-700 transition peer-checked:border-violet-700 peer-checked:bg-violet-50 peer-focus-visible:ring-4 peer-focus-visible:ring-violet-200">
                      <span
                        className="block text-lg leading-6 text-zinc-900"
                        style={{ fontFamily: FONT_STACK[font] }}
                      >
                        Aa
                      </span>
                      <span className="mt-1 block">{FONT_LABELS[font]}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-zinc-800">Card style</legend>
              <div className="grid grid-cols-2 gap-2">
                {CARD_STYLES.map((card) => (
                  <label key={card} className="cursor-pointer">
                    <input
                      type="radio"
                      name="appearance-card"
                      value={card}
                      checked={draft.card === card}
                      onChange={() => update("card", card)}
                      className="peer sr-only"
                    />
                    <span className="block rounded-lg border-2 border-zinc-200 bg-white p-2 text-center text-xs font-semibold text-zinc-700 transition peer-checked:border-violet-700 peer-checked:bg-violet-50 peer-focus-visible:ring-4 peer-focus-visible:ring-violet-200">
                      <span
                        className="mx-auto block h-8 w-14 border-2 border-violet-300 bg-violet-50"
                        style={{ borderRadius: CARD_RADII[card] }}
                      />
                      <span className="mt-1.5 block">{CARD_LABELS[card]}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-zinc-800">Button style</legend>
              <div className="grid grid-cols-2 gap-2">
                {BUTTON_STYLES.map((button) => (
                  <label key={button} className="cursor-pointer">
                    <input
                      type="radio"
                      name="appearance-button"
                      value={button}
                      checked={draft.button === button}
                      onChange={() => update("button", button)}
                      className="peer sr-only"
                    />
                    <span className="block rounded-lg border-2 border-zinc-200 bg-white p-2 text-center text-xs font-semibold text-zinc-700 transition peer-checked:border-violet-700 peer-checked:bg-violet-50 peer-focus-visible:ring-4 peer-focus-visible:ring-violet-200">
                      <span
                        className="mx-auto block h-8 w-14 rounded-md"
                        style={
                          button === "brand"
                            ? {
                                backgroundColor: draft.color,
                                border: `1px solid ${draft.color}`,
                              }
                            : button === "solid"
                              ? {
                                  backgroundColor: "#ffffff",
                                  border: "1px solid #ddd6fe",
                                }
                              : button === "outline"
                                ? { border: `2px solid ${draft.color}` }
                                : {
                                    background: "linear-gradient(135deg,#ede9fe,#fff)",
                                    border: "1px solid #ddd6fe",
                                  }
                        }
                      />
                      <span className="mt-1.5 block">{BUTTON_LABELS[button]}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <ul className="space-y-3">
              {TOGGLES.map((toggle) => (
                <li key={toggle.key} className="flex items-center justify-between gap-3 text-sm">
                  <span id={`toggle-${toggle.key}`}>{toggle.label}</span>
                  <Switch
                    checked={draft[toggle.key]}
                    onCheckedChange={(checked) => update(toggle.key, checked)}
                    aria-labelledby={`toggle-${toggle.key}`}
                  />
                </li>
              ))}
            </ul>
          </section>
        </Card>
      </div>

      <p className="mt-4 text-xs text-zinc-500">
        Backgrounds are rendered with CSS; no image upload is required. The Brand
        button style fills every link card with your primary color.
      </p>

      <Dialog
        open={resetTarget !== null}
        onOpenChange={(open) => {
          if (!open) setResetTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {resetTarget === "preset" ? "Reset to preset?" : "Reset to default?"}
            </DialogTitle>
            <DialogDescription>
              {resetTarget === "preset" ? (
                <>
                  This replaces your custom colors, background, font, card and
                  button choices with the <strong>{currentPresetName}</strong>{" "}
                  preset values. Layout and visibility switches are kept.
                </>
              ) : (
                <>
                  This restores every appearance setting, including the theme
                  preset, to its default value. Your unsaved choices are
                  discarded.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setResetTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={resetTarget === "preset" ? resetToPreset : resetDraft}
              disabled={resetTarget === null}
            >
              Reset appearance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardFrame>
  );
}
