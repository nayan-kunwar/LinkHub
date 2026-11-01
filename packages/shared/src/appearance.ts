import { THEME_PRESETS, type ThemePresetDef } from "./constants";
import type { AppearanceSettings } from "./types";

export function themePresetFor(appearance: AppearanceSettings): ThemePresetDef {
  return (
    THEME_PRESETS.find((preset) => preset.id === appearance.theme) ??
    THEME_PRESETS[0]
  );
}

/**
 * Switching presets should not erase deliberate accent/background choices.
 * Selecting the active preset, or "Reset to preset", applies the whole preset.
 */
export function applyThemePreset(
  current: AppearanceSettings,
  preset: ThemePresetDef,
  options: { force?: boolean } = {},
): AppearanceSettings {
  const currentPreset = themePresetFor(current);
  const samePreset = current.theme === preset.id;
  const preserveAccent =
    !options.force &&
    !samePreset &&
    current.color.toLowerCase() !== (currentPreset.accent ?? "").toLowerCase();
  const preserveBackground =
    !options.force && !samePreset && current.background !== "gradient";

  return {
    ...current,
    theme: preset.id as AppearanceSettings["theme"],
    color: preserveAccent ? current.color : preset.accent ?? current.color,
    background: preserveBackground ? current.background : "gradient",
    font: preset.font ?? current.font,
    card: preset.card ?? current.card,
    button: preset.button ?? current.button,
  };
}
