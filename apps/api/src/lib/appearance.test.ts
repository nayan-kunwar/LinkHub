import { describe, expect, it } from "vitest";
import {
  applyThemePreset,
  AUTO_COLOR,
  DEFAULT_APPEARANCE,
  THEME_PRESETS,
  type AppearanceSettings,
} from "@linkhub/shared";

const base: AppearanceSettings = structuredClone(DEFAULT_APPEARANCE);
const dark = THEME_PRESETS.find((preset) => preset.id === "dark")!;
const maroon = THEME_PRESETS.find((preset) => preset.id === "maroon-serif")!;

function preset(id: string) {
  const found = THEME_PRESETS.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`Missing preset ${id}`);
  return found;
}

describe("applyThemePreset", () => {
  it("does nothing when the selected preset is already active", () => {
    const current = { ...base, theme: "dark" as const, color: "#123456" };
    expect(applyThemePreset(current, dark)).toBe(current);
  });

  it("preserves a custom accent and background when switching presets", () => {
    const next = applyThemePreset(
      { ...base, color: "#123456", background: "solid" },
      dark,
    );
    expect(next.theme).toBe("dark");
    expect(next.color).toBe("#123456");
    expect(next.background).toBe("solid");
  });

  it("adopts the target accent when the current accent is untouched", () => {
    const next = applyThemePreset(base, dark);
    expect(next.color).toBe(dark.accent);
    expect(next.background).toBe("gradient");
  });

  it("preserves custom font, card and button choices when switching presets", () => {
    const next = applyThemePreset(
      { ...base, font: "serif", card: "pill", button: "outline" },
      preset("soft-grey"),
    );
    expect(next.theme).toBe("soft-grey");
    expect(next.font).toBe("serif");
    expect(next.card).toBe("pill");
    expect(next.button).toBe("outline");
  });

  it("adopts the target font, card and button when they are untouched", () => {
    const next = applyThemePreset(base, maroon);
    expect(next.font).toBe(maroon.font);
    expect(next.card).toBe(maroon.card);
    expect(next.button).toBe(maroon.button);
  });

  it("keeps current shape values when the target preset does not define them", () => {
    const current: AppearanceSettings = {
      ...base,
      theme: "maroon-serif",
      font: "serif",
      card: "rounded",
      button: "outline",
    };
    const next = applyThemePreset(current, preset("default"));
    expect(next.font).toBe("serif");
    expect(next.card).toBe("rounded");
    expect(next.button).toBe("outline");
  });

  it("keeps layout, visibility and other settings unchanged", () => {
    const current: AppearanceSettings = {
      ...base,
      layout: "flat",
      showAvatar: false,
      showDescription: true,
    };
    const next = applyThemePreset(current, dark);
    expect(next.layout).toBe("flat");
    expect(next.showAvatar).toBe(false);
    expect(next.showDescription).toBe(true);
  });

  it("force-applies a preset, including its shape values", () => {
    const next = applyThemePreset(
      { ...base, color: "#123456", font: "sans", card: "pill", button: "glass" },
      maroon,
      { force: true },
    );
    expect(next.color).toBe(maroon.accent);
    expect(next.background).toBe("gradient");
    expect(next.font).toBe(maroon.font);
    expect(next.card).toBe(maroon.card);
    expect(next.button).toBe(maroon.button);
  });

  it("force-applies defaults for fields the preset does not define", () => {
    const next = applyThemePreset(
      {
        ...base,
        theme: "maroon-serif",
        color: "#123456",
        background: "solid",
        font: "serif",
        card: "pill",
        button: "glass",
      },
      preset("default"),
      { force: true },
    );
    expect(next.color).toBe(DEFAULT_APPEARANCE.color);
    expect(next.background).toBe(DEFAULT_APPEARANCE.background);
    expect(next.font).toBe(DEFAULT_APPEARANCE.font);
    expect(next.card).toBe(DEFAULT_APPEARANCE.card);
    expect(next.button).toBe(DEFAULT_APPEARANCE.button);
  });

  it("clears every palette override when force-applying a preset", () => {
    const next = applyThemePreset(
      {
        ...base,
        backgroundColor: "#abcdef",
        buttonTextColor: AUTO_COLOR,
        pageTextColor: "#123456",
        titleColor: AUTO_COLOR,
      },
      dark,
      { force: true },
    );
    expect(next.backgroundColor).toBeUndefined();
    expect(next.buttonTextColor).toBeUndefined();
    expect(next.pageTextColor).toBeUndefined();
    expect(next.titleColor).toBeUndefined();
  });

  it("keeps palette overrides when switching presets without force", () => {
    const current: AppearanceSettings = {
      ...base,
      backgroundColor: "#abcdef",
      buttonTextColor: AUTO_COLOR,
      pageTextColor: "#123456",
      titleColor: AUTO_COLOR,
    };
    const next = applyThemePreset(current, dark);
    expect(next.backgroundColor).toBe("#abcdef");
    expect(next.buttonTextColor).toBe(AUTO_COLOR);
    expect(next.pageTextColor).toBe("#123456");
    expect(next.titleColor).toBe(AUTO_COLOR);
  });

  it("keeps layout and visibility when force-applying a preset", () => {
    const next = applyThemePreset(
      {
        ...base,
        layout: "flat",
        showAvatar: false,
        showSocial: false,
        showDescription: true,
      },
      maroon,
      { force: true },
    );
    expect(next.layout).toBe("flat");
    expect(next.showAvatar).toBe(false);
    expect(next.showSocial).toBe(false);
    expect(next.showDescription).toBe(true);
  });
});
