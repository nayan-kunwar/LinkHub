import type { CSSProperties } from "react";
import type {
  AppearanceSettings,
  ButtonStyle,
  CardStyle,
  FontChoice,
  ThemePresetDef,
} from "@linkhub/shared";
import { THEME_PRESETS } from "@linkhub/shared";

export type ThemePreset = ThemePresetDef;

export function themeFor(appearance: AppearanceSettings): ThemePreset {
  return (
    THEME_PRESETS.find((preset) => preset.id === appearance.theme) ??
    THEME_PRESETS[0]
  );
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

export const FONT_STACK: Record<FontChoice, string> = {
  sans: "var(--font-inter), ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
  serif: "var(--font-serif), Georgia, 'Times New Roman', serif",
};

const RADIUS: Record<CardStyle, string> = {
  rounded: "14px",
  soft: "22px",
  minimal: "4px",
  pill: "9999px",
};

const MEDIA_RADIUS: Record<CardStyle, string> = {
  rounded: "14px",
  soft: "22px",
  minimal: "4px",
  pill: "22px",
};

/** White on dark accents, near-black on light ones, so brand cards stay legible. */
function readableText(hex: string): string {
  const value = hex.replace("#", "");
  if (value.length !== 6) return "#ffffff";
  const number = Number.parseInt(value, 16);
  if (Number.isNaN(number)) return "#ffffff";
  const [r, g, b] = [number >> 16, (number >> 8) & 255, number & 255];
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.62 ? "#18181b" : "#ffffff";
}

/**
 * All block colours come from these variables, set once on the profile
 * wrapper. Blocks never receive the theme or appearance as props.
 */
export function themeVars(
  appearance: AppearanceSettings,
  theme: ThemePreset,
): CSSProperties {
  const surface =
    theme.surface ?? (theme.dark ? "rgba(255,255,255,0.08)" : "#ffffff");
  const hairline =
    theme.border ?? (theme.dark ? "rgba(255,255,255,0.13)" : "#ede9fe");

  const brand = appearance.button === "brand";
  const brandText = brand ? readableText(appearance.color) : theme.text;
  const brandMuted = brand
    ? brandText === "#ffffff"
      ? "rgba(255,255,255,0.85)"
      : "rgba(24,24,27,0.7)"
    : theme.muted;
  const cardBg = brand
    ? appearance.color
    : appearance.button === "outline"
      ? "transparent"
      : appearance.button === "glass"
        ? theme.dark
          ? "rgba(255,255,255,0.12)"
          : "rgba(255,255,255,0.65)"
        : surface;
  const cardBorder = brand
    ? `1px solid ${appearance.color}`
    : appearance.button === "outline"
      ? `1.5px solid ${appearance.color}`
      : appearance.button === "glass"
        ? "1px solid rgba(255,255,255,0.5)"
        : `1px solid ${hairline}`;
  const cardShadow =
    appearance.button === "solid"
      ? "0 1px 3px rgba(0,0,0,0.06)"
      : brand
        ? `0 8px 22px ${appearance.color}33`
        : "none";

  return {
    "--lh-bg": backgroundFor(appearance, theme),
    "--lh-text": theme.text,
    "--lh-muted": theme.muted,
    "--lh-accent": appearance.color,
    "--lh-font": FONT_STACK[appearance.font ?? "sans"],
    "--lh-radius": RADIUS[appearance.card],
    "--lh-radius-media": MEDIA_RADIUS[appearance.card],
    "--lh-card-bg": cardBg,
    "--lh-card-border": cardBorder,
    "--lh-card-shadow": cardShadow,
    "--lh-card-text": brandText,
    "--lh-card-muted": brandMuted,
    "--lh-blur": appearance.button === "glass" ? "blur(6px)" : "none",
  } as CSSProperties;
}

export const BUTTON_LABELS: Record<ButtonStyle, string> = {
  solid: "Solid",
  outline: "Outline",
  glass: "Glass",
  brand: "Brand",
};

export const CARD_LABELS: Record<CardStyle, string> = {
  rounded: "Rounded",
  soft: "Soft",
  minimal: "Minimal",
  pill: "Pill",
};

export const CARD_RADII: Record<CardStyle, string> = {
  rounded: "8px",
  soft: "14px",
  minimal: "2px",
  pill: "999px",
};
