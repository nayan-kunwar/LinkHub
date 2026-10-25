import { describe, expect, it } from "vitest";
import { AppError } from "../../lib/errors";
import { csvCell } from "./export.service";
import { parseExportOptions } from "./export.schema";

describe("export CSV escaping", () => {
  it("prefixes formula-leading cells before quoting", () => {
    expect(csvCell("=1+1")).toBe("'=1+1");
    expect(csvCell("+SUM(A1)")).toBe("'+SUM(A1)");
    expect(csvCell("-2")).toBe("'-2");
    expect(csvCell("@cmd")).toBe("'@cmd");
    expect(csvCell("\tfoo")).toBe("'\tfoo");
    expect(csvCell("\rfoo")).toBe('"\'\rfoo"');
    expect(csvCell("=1,2")).toBe('"\'=1,2"');
  });

  it("quotes commas, quotes, LF and CR with doubled quotes", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line\nbreak")).toBe('"line\nbreak"');
    expect(csvCell("line\rbreak")).toBe('"line\rbreak"');
  });

  it("leaves ordinary cells untouched", () => {
    expect(csvCell("Nayan Kunwar")).toBe("Nayan Kunwar");
    expect(csvCell(42)).toBe("42");
    expect(csvCell(false)).toBe("false");
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });
});

describe("export options", () => {
  it("defaults to every section", () => {
    const options = parseExportOptions({ format: "json" });
    expect(options.format).toBe("json");
    expect(options.sections).toEqual(
      new Set(["profile", "links", "categories", "analytics"]),
    );
  });

  it("accepts a comma-separated include list", () => {
    const options = parseExportOptions({ format: "csv", include: "profile, links" });
    expect(options.sections).toEqual(new Set(["profile", "links"]));
  });

  it("accepts repeated include query values", () => {
    const options = parseExportOptions({
      format: "json",
      include: ["categories", "analytics"],
    });
    expect(options.sections).toEqual(new Set(["categories", "analytics"]));
  });

  it("forces profile and links for the profile-only format", () => {
    const options = parseExportOptions({ format: "profile", include: "analytics" });
    expect(options.sections).toEqual(new Set(["profile", "links"]));
  });

  it("rejects unknown or empty sections", () => {
    expect(() => parseExportOptions({ format: "json", include: "profile,nope" })).toThrow(
      AppError,
    );
    expect(() => parseExportOptions({ format: "json", include: "" })).toThrow(AppError);
    expect(() => parseExportOptions({ format: "json", include: [] })).toThrow(AppError);
  });
});

describe("export option wrapper", () => {
  it("returns the same shape as the schema parser", () => {
    const options = parseExportOptions({ format: "csv", include: "links" });
    expect(options.sections).toEqual(new Set(["links"]));
  });
});
