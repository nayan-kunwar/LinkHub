import { describe, expect, it } from "vitest";
import {
  bestTextColor,
  contrastRatio,
  isDarkColor,
  mixHex,
  normalizeHexColor,
  relativeLuminance,
  withAlpha,
  worstContrast,
} from "@linkhub/shared";

describe("normalizeHexColor", () => {
  it("expands short values and uppercases results", () => {
    expect(normalizeHexColor("#abc")).toBe("#AABBCC");
    expect(normalizeHexColor("abc")).toBe("#AABBCC");
    expect(normalizeHexColor("  #a1b2c3  ")).toBe("#A1B2C3");
    expect(normalizeHexColor("a1b2c3")).toBe("#A1B2C3");
  });

  it("rejects anything that is not three or six hex digits", () => {
    expect(normalizeHexColor("")).toBeNull();
    expect(normalizeHexColor("#abcd")).toBeNull();
    expect(normalizeHexColor("#gggggg")).toBeNull();
    expect(normalizeHexColor("auto")).toBeNull();
    expect(normalizeHexColor("#a1b2c3d")).toBeNull();
    expect(normalizeHexColor("rgb(0,0,0)")).toBeNull();
  });
});

describe("contrast helpers", () => {
  it("computes WCAG luminance at the extremes", () => {
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#FFFFFF")).toBe(1);
    expect(relativeLuminance("nope")).toBeNull();
  });

  it("returns the WCAG ratio for black and white", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 5);
    expect(contrastRatio("#123456", "#123456")).toBeCloseTo(1, 5);
    expect(contrastRatio("#000000", "nope")).toBeNull();
  });

  it("uses the worst surface for mixed backgrounds", () => {
    expect(worstContrast("#FFFFFF", ["#000000", "#111111"])).toBeCloseTo(
      contrastRatio("#FFFFFF", "#111111")!,
      5,
    );
    expect(worstContrast("#FFFFFF", [])).toBeNull();
  });
});

describe("bestTextColor", () => {
  it("always returns pure black or pure white", () => {
    const picks = new Set(
      [
        "#FFFFFF",
        "#000000",
        "#0284C7",
        "#7C3AED",
        "#E0F2FE",
        "#16142F",
        "#FDE9B8",
      ].map((surface) => bestTextColor([surface])),
    );
    expect([...picks].sort()).toEqual(["#000000", "#FFFFFF"]);
  });

  it("picks black on light surfaces and white on dark surfaces", () => {
    expect(bestTextColor(["#FFFFFF"])).toBe("#000000");
    expect(bestTextColor(["#E0F2FE"])).toBe("#000000");
    expect(bestTextColor(["#000000"])).toBe("#FFFFFF");
    expect(bestTextColor(["#16142F"])).toBe("#FFFFFF");
  });

  it("picks black for the Ocean accent, where it has the better ratio", () => {
    // Black is 5.13:1 and white is 4.10:1 on #0284C7.
    expect(contrastRatio("#000000", "#0284C7")).toBeGreaterThan(
      contrastRatio("#FFFFFF", "#0284C7")!,
    );
    expect(bestTextColor(["#0284C7"])).toBe("#000000");
  });

  it("falls back to black without any surfaces", () => {
    expect(bestTextColor([])).toBe("#000000");
  });
});

describe("colour utilities", () => {
  it("mixes colours in sRGB space", () => {
    expect(mixHex("#000000", "#FFFFFF", 0.5)).toBe("#808080");
    expect(mixHex("#000000", "#FFFFFF", 1)).toBe("#FFFFFF");
    expect(mixHex("#ABCDEF", "#000000", 0)).toBe("#ABCDEF");
    expect(mixHex("nope", "#FFFFFF", 0.5)).toBe("#000000");
  });

  it("detects dark colours with the shared threshold", () => {
    expect(isDarkColor("#000000")).toBe(true);
    expect(isDarkColor("#16142F")).toBe(true);
    expect(isDarkColor("#FFFFFF")).toBe(false);
    expect(isDarkColor("#E0F2FE")).toBe(false);
    expect(isDarkColor("nope")).toBe(false);
  });

  it("formats rgba values", () => {
    expect(withAlpha("#0284C7", 0.5)).toBe("rgba(2,132,199,0.5)");
    expect(withAlpha("nope", 0.25)).toBe("rgba(255,255,255,0.25)");
  });
});
