/** Colour helpers shared by the profile renderer and the appearance editor. */

const HEX_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * Accepts `abc`, `#abc`, `aabbcc` and `#aabbcc`, returning an uppercase
 * six-digit `#RRGGBB` value. Returns null for anything else.
 */
export function normalizeHexColor(value: string): string | null {
  const match = value.trim().match(HEX_PATTERN);
  if (!match) return null;
  const raw =
    match[1].length === 3
      ? match[1]
          .split("")
          .map((character) => character + character)
          .join("")
      : match[1];
  return `#${raw.toUpperCase()}`;
}

export function hexToRgb(hex: string): [number, number, number] | null {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return null;
  const value = Number.parseInt(normalized.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function relativeLuminance(hex: string): number | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.03928
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, or null when either colour cannot be parsed. */
export function contrastRatio(foreground: string, background: string): number | null {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  if (first === null || second === null) return null;
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

/** Worst-case contrast across every surface the text can sit on. */
export function worstContrast(foreground: string, surfaces: string[]): number | null {
  const ratios = surfaces
    .map((surface) => contrastRatio(foreground, surface))
    .filter((ratio): ratio is number => ratio !== null);
  return ratios.length > 0 ? Math.min(...ratios) : null;
}

/**
 * Auto text is always pure black or pure white, whichever survives the
 * surfaces best. It intentionally never returns a grey.
 */
export function bestTextColor(surfaces: string[]): "#000000" | "#FFFFFF" {
  const candidates = ["#000000", "#FFFFFF"] as const;
  let winner: (typeof candidates)[number] = "#000000";
  let score = -1;
  for (const candidate of candidates) {
    const current = worstContrast(candidate, surfaces);
    if (current !== null && current > score) {
      score = current;
      winner = candidate;
    }
  }
  return winner;
}

/** Mixes two hex colours in sRGB space. `weight` is the share of `b`. */
export function mixHex(a: string, b: string, weight: number): string {
  const first = hexToRgb(a);
  const second = hexToRgb(b);
  if (!first || !second) return normalizeHexColor(a) ?? "#000000";
  const channels = first.map((value, index) =>
    Math.round(value + (second[index] - value) * weight),
  );
  return `#${channels
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

export function isDarkColor(hex: string): boolean {
  const luminance = relativeLuminance(hex);
  return luminance !== null && luminance < 0.45;
}

export function withAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(255,255,255,${alpha})`;
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
}
