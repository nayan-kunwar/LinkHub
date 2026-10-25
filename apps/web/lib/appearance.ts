import type { AppearanceSettings } from "@linkhub/shared";
import { THEME_PRESETS } from "@linkhub/shared";

export type ThemePreset = (typeof THEME_PRESETS)[number];

export function themeFor(appearance: AppearanceSettings): ThemePreset {
  return THEME_PRESETS.find((preset) => preset.id === appearance.theme) ?? THEME_PRESETS[0];
}

/**
 * Resolves the public-profile background for a preset and background style.
 * Kept in one place so the live editor preview and the rendered profile agree.
 */
export function backgroundFor(
  appearance: AppearanceSettings,
  theme: ThemePreset = themeFor(appearance),
): string {
  if (appearance.background === "solid") return theme.solid;
  if (appearance.background === "pattern") {
    return `radial-gradient(${theme.dark ? "#ffffff22" : "#7c3aed22"} 1.2px, transparent 1.3px) 0 0/14px 14px, ${theme.solid}`;
  }
  if (appearance.background === "blur") {
    return `radial-gradient(circle at 20% 15%, ${appearance.color}55, transparent 45%), radial-gradient(circle at 85% 60%, ${appearance.color}40, transparent 45%), ${theme.solid}`;
  }
  return theme.background;
}
