import type { AppearanceSettings } from "./types";

/**
 * Single source of truth for a profile that has never saved appearance settings.
 * Every optional field is present so `parseAppearance` can fill old stored JSON.
 */
export const DEFAULT_APPEARANCE: AppearanceSettings = {
  theme: "default",
  color: "#7c3aed",
  background: "gradient",
  card: "rounded",
  button: "solid",
  layout: "grouped",
  font: "sans",
  showAvatar: true,
  showBio: true,
  showSocial: true,
  showDescription: false,
};
