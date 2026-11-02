import { describe, expect, it } from "vitest";
import { windowFor, type Period } from "./analytics.service";

function utc(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function period(start: string, endExclusive: string, days: number): Period {
  return { start: utc(start), endExclusive: utc(endExclusive), days };
}

describe("windowFor", () => {
  it("splits a range at the watermark", () => {
    const window = windowFor(
      period("2026-10-01", "2026-10-31", 30),
      utc("2026-10-20"),
    );
    expect(window.hasStats).toBe(true);
    expect(window.statsStart).toEqual(utc("2026-10-01"));
    expect(window.statsEnd).toEqual(utc("2026-10-20"));
    expect(window.hasRaw).toBe(true);
    expect(window.rawStart).toEqual(utc("2026-10-21"));
  });

  it("reads only raw events when the watermark is before the range", () => {
    const window = windowFor(
      period("2026-10-01", "2026-10-08", 7),
      utc("2026-09-20"),
    );
    expect(window.hasStats).toBe(false);
    expect(window.hasRaw).toBe(true);
    expect(window.rawStart).toEqual(utc("2026-10-01"));
  });

  it("reads only rolled-up stats when the whole range is complete", () => {
    const window = windowFor(
      period("2026-10-01", "2026-10-08", 7),
      utc("2026-10-07"),
    );
    expect(window.hasStats).toBe(true);
    expect(window.statsEnd).toEqual(utc("2026-10-07"));
    expect(window.hasRaw).toBe(false);
  });

  it("uses raw events for the whole range when no rollup has run", () => {
    const window = windowFor(period("2026-10-01", "2026-10-08", 7), null);
    expect(window.hasStats).toBe(false);
    expect(window.hasRaw).toBe(true);
    expect(window.rawStart).toEqual(utc("2026-10-01"));
    expect(window.endExclusive).toEqual(utc("2026-10-08"));
  });
});
