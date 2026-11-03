import { THEME_PRESETS, type ThemePresetDef } from "./constants";
import { DEFAULT_APPEARANCE } from "./defaults";
import type { AppearanceSettings } from "./types";

export function themePresetFor(appearance: AppearanceSettings): ThemePresetDef {
  return (
    THEME_PRESETS.find((preset) => preset.id === appearance.theme) ??
    THEME_PRESETS[0]
  );
}

/**
 * Switching presets should not erase deliberate choices. Background style is
 * independent of a preset and is always kept; a custom accent, font, card or
 * button is kept only when it differs from the active preset (falling back to
 * the shared defaults). Selecting the active preset is a no-op; "Reset to
 * preset" forces the whole preset.
 */
export function applyThemePreset(
  current: AppearanceSettings,
  preset: ThemePresetDef,
  options: { force?: boolean } = {},
): AppearanceSettings {
  const samePreset = current.theme === preset.id;
  if (samePreset && !options.force) return current;

  if (options.force) {
    return {
      ...current,
      theme: preset.id as AppearanceSettings["theme"],
      color: preset.accent ?? DEFAULT_APPEARANCE.color,
      background: DEFAULT_APPEARANCE.background,
      font: preset.font ?? DEFAULT_APPEARANCE.font,
      card: preset.card ?? DEFAULT_APPEARANCE.card,
      button: preset.button ?? DEFAULT_APPEARANCE.button,
      // A forced preset replaces the whole palette, including auto values.
      backgroundColor: undefined,
      buttonTextColor: undefined,
      pageTextColor: undefined,
      titleColor: undefined,
    };
  }

  const currentPreset = themePresetFor(current);
  const preserveAccent =
    current.color.toLowerCase() !==
    (currentPreset.accent ?? DEFAULT_APPEARANCE.color).toLowerCase();
  const preserveFont =
    current.font !== (currentPreset.font ?? DEFAULT_APPEARANCE.font);
  const preserveCard =
    current.card !== (currentPreset.card ?? DEFAULT_APPEARANCE.card);
  const preserveButton =
    current.button !== (currentPreset.button ?? DEFAULT_APPEARANCE.button);

  return {
    ...current,
    theme: preset.id as AppearanceSettings["theme"],
    color: preserveAccent ? current.color : preset.accent ?? current.color,
    // Background style is independent of a preset, so keep the current choice.
    background: current.background,
    font: preserveFont ? current.font : preset.font ?? current.font,
    card: preserveCard ? current.card : preset.card ?? current.card,
    button: preserveButton ? current.button : preset.button ?? current.button,
  };
}
