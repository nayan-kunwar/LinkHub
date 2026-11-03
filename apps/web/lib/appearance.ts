import type { CSSProperties } from "react";
import {
  AUTO_COLOR,
  bestTextColor,
  isDarkColor,
  mixHex,
  normalizeHexColor,
  withAlpha,
  worstContrast,
  type AppearanceColorKey,
  type AppearanceSettings,
  type ButtonStyle,
  type CardStyle,
  type FontChoice,
  type ThemePresetDef,
} from "@linkhub/shared";
import { themePresetFor } from "@linkhub/shared";

export type ThemePreset = ThemePresetDef;

export const themeFor = themePresetFor;

export { applyThemePreset } from "@linkhub/shared";

/**
 * Preserved for profiles saved before the palette editor. A near-black is
 * softer than pure black on light cards, while Auto uses pure black/white.
 */
function readableText(hex: string): string {
  const value = hex.replace("#", "");
  if (value.length !== 6) return "#ffffff";
  const number = Number.parseInt(value, 16);
  if (Number.isNaN(number)) return "#ffffff";
  const [r, g, b] = [number >> 16, (number >> 8) & 255, number & 255];
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.62 ? "#18181b" : "#ffffff";
}

/** The button-text colour a preset uses when no override has been stored. */
export function defaultButtonText(accent: string): string {
  return readableText(normalizeHexColor(accent) ?? accent);
}

/** The base colour behind solid, pattern, gradient and blur backgrounds. */
export function backgroundBaseFor(
  appearance: AppearanceSettings,
  theme: ThemePreset = themeFor(appearance),
): string {
  return (
    normalizeHexColor(appearance.backgroundColor ?? "") ??
    normalizeHexColor(theme.solid) ??
    theme.solid
  );
}

export function backgroundIsDark(
  appearance: AppearanceSettings,
  theme: ThemePreset = themeFor(appearance),
): boolean {
  return isDarkColor(backgroundBaseFor(appearance, theme));
}

function gradientFor(base: string): string {
  const dark = isDarkColor(base);
  const top = mixHex(base, "#FFFFFF", dark ? 0.08 : 0.34);
  const bottom = mixHex(base, "#000000", dark ? 0.3 : 0.06);
  return `linear-gradient(180deg,${top},${base} 52%,${bottom})`;
}

function hasBackgroundOverride(
  appearance: AppearanceSettings,
  theme: ThemePreset,
): boolean {
  const override = normalizeHexColor(appearance.backgroundColor ?? "");
  if (!override) return false;
  return override !== normalizeHexColor(theme.solid);
}

/**
 * Resolves the public-profile background for a preset and background style.
 * Kept in one place so the live editor preview and the rendered profile agree.
 */
export function backgroundFor(
  appearance: AppearanceSettings,
  theme: ThemePreset = themeFor(appearance),
): string {
  const base = backgroundBaseFor(appearance, theme);
  if (appearance.background === "solid") return base;
  if (appearance.background === "pattern") {
    const dot = isDarkColor(base)
      ? "rgba(255,255,255,.17)"
      : "rgba(15,23,42,.11)";
    return `radial-gradient(${dot} 1.2px, transparent 1.3px) 0 0/14px 14px, ${base}`;
  }
  if (appearance.background === "blur") {
    return `radial-gradient(circle at 18% 12%, ${appearance.color}55, transparent 45%), radial-gradient(circle at 82% 62%, ${appearance.color}40, transparent 48%), ${base}`;
  }
  // Without an override, keep the hand-tuned preset gradient exactly.
  return hasBackgroundOverride(appearance, theme)
    ? gradientFor(base)
    : theme.background;
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

export interface ResolvedPalette {
  background: string;
  buttons: string;
  buttonText: string;
  pageText: string;
  title: string;
}

/** Every colour the preview can paint text on. */
export function pageSurfacesFor(
  appearance: AppearanceSettings,
  theme: ThemePreset,
): string[] {
  const base = backgroundBaseFor(appearance, theme);
  if (appearance.background === "gradient") {
    if (!hasBackgroundOverride(appearance, theme)) return [base];
    const dark = isDarkColor(base);
    return [
      base,
      mixHex(base, "#FFFFFF", dark ? 0.08 : 0.34),
      mixHex(base, "#000000", dark ? 0.3 : 0.06),
    ];
  }
  if (appearance.background === "blur") {
    return [...new Set([base, mixHex(base, appearance.color, 0.42)])];
  }
  return [base];
}

export function cardSurfacesFor(
  appearance: AppearanceSettings,
  theme: ThemePreset,
): string[] {
  if (appearance.button === "brand") return [appearance.color];
  if (appearance.button === "outline") {
    return pageSurfacesFor(appearance, theme);
  }
  const base = backgroundBaseFor(appearance, theme);
  if (appearance.button === "glass") {
    return [
      isDarkColor(base)
        ? mixHex(base, "#FFFFFF", 0.12)
        : mixHex(base, "#FFFFFF", 0.62),
    ];
  }
  const surface = normalizeHexColor(theme.surface ?? "");
  if (surface) return [surface];
  return [isDarkColor(base) ? mixHex(base, "#FFFFFF", 0.1) : "#FFFFFF"];
}

export function textSurfacesFor(
  appearance: AppearanceSettings,
  theme: ThemePreset,
): string[] {
  const surfaces = pageSurfacesFor(appearance, theme);
  if (appearance.button !== "brand") {
    surfaces.push(...cardSurfacesFor(appearance, theme));
  }
  return [...new Set(surfaces)];
}

function buttonTextSurfacesFor(
  appearance: AppearanceSettings,
): string[] {
  return appearance.button === "brand" ? [appearance.color] : [];
}

/**
 * Resolves all five palette slots. Auto values become pure black or white,
 * while missing overrides fall back to the preset so old profiles do not move.
 */
export function resolvedPalette(
  appearance: AppearanceSettings,
  theme: ThemePreset,
): ResolvedPalette {
  const background = backgroundBaseFor(appearance, theme);
  const buttons = normalizeHexColor(appearance.color) ?? appearance.color;
  const textSurfaces = textSurfacesFor(appearance, theme);

  const buttonText =
    appearance.buttonTextColor === AUTO_COLOR
      ? bestTextColor([buttons])
      : (normalizeHexColor(appearance.buttonTextColor ?? "") ??
        defaultButtonText(buttons));

  const pageText =
    appearance.pageTextColor === AUTO_COLOR
      ? bestTextColor(textSurfaces)
      : (normalizeHexColor(appearance.pageTextColor ?? "") ?? theme.muted);

  const title =
    appearance.titleColor === AUTO_COLOR
      ? bestTextColor(textSurfaces)
      : (normalizeHexColor(appearance.titleColor ?? "") ?? theme.text);

  return { background, buttons, buttonText, pageText, title };
}

/** Contrast ratio for a palette row, or null when the row has no text uses. */
export function paletteContrast(
  key: AppearanceColorKey,
  appearance: AppearanceSettings,
  theme: ThemePreset,
): number | null {
  if (key === "background" || key === "buttons") return null;
  const palette = resolvedPalette(appearance, theme);
  const surfaces =
    key === "buttonText"
      ? buttonTextSurfacesFor(appearance)
      : textSurfacesFor(appearance, theme);
  if (surfaces.length === 0) return null;
  return worstContrast(palette[key], surfaces);
}

/**
 * All block colours come from these variables, set once on the profile
 * wrapper. Blocks never receive the theme or appearance as props.
 */
export function themeVars(
  appearance: AppearanceSettings,
  theme: ThemePreset,
): CSSProperties {
  const palette = resolvedPalette(appearance, theme);
  const darkSurface = isDarkColor(palette.background);
  const surface =
    theme.surface ??
    (darkSurface
      ? theme.dark
        ? "rgba(255,255,255,0.08)"
        : mixHex(palette.background, "#FFFFFF", 0.1)
      : "#ffffff");
  const hairline =
    theme.border ?? (darkSurface ? "rgba(255,255,255,0.13)" : "#ede9fe");

  const brand = appearance.button === "brand";
  const cardBg = brand
    ? palette.buttons
    : appearance.button === "outline"
      ? "transparent"
      : appearance.button === "glass"
        ? darkSurface
          ? "rgba(255,255,255,0.12)"
          : "rgba(255,255,255,0.65)"
        : surface;
  const cardBorder = brand
    ? `1px solid ${palette.buttons}`
    : appearance.button === "outline"
      ? `1.5px solid ${palette.buttons}`
      : appearance.button === "glass"
        ? "1px solid rgba(255,255,255,0.5)"
        : `1px solid ${hairline}`;
  const cardShadow =
    appearance.button === "solid"
      ? "0 1px 3px rgba(0,0,0,0.06)"
      : brand
        ? `0 8px 22px ${palette.buttons}33`
        : "none";

  return {
    "--lh-bg": backgroundFor(appearance, theme),
    "--lh-text": palette.title,
    "--lh-muted": palette.pageText,
    "--lh-accent": palette.buttons,
    "--lh-font": FONT_STACK[appearance.font ?? "sans"],
    "--lh-radius": RADIUS[appearance.card],
    "--lh-radius-media": MEDIA_RADIUS[appearance.card],
    "--lh-card-bg": cardBg,
    "--lh-card-border": cardBorder,
    "--lh-card-shadow": cardShadow,
    "--lh-card-text": brand ? palette.buttonText : palette.title,
    "--lh-card-muted": brand
      ? withAlpha(palette.buttonText, 0.84)
      : palette.pageText,
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
