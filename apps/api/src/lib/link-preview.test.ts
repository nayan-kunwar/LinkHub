import { describe, expect, it } from "vitest";
import { previewImageFor } from "./link-preview";

const SOURCE_URL = "https://example.com/article";
const FETCHED_AT = "2026-11-01T12:00:00.000Z";

function link(imageUrl: string) {
  return {
    url: SOURCE_URL,
    type: "link",
    config: { layout: "rich" },
    metadata: {
      sourceUrl: SOURCE_URL,
      finalUrl: SOURCE_URL,
      title: "Example",
      description: "",
      imageUrl,
      siteName: "Example",
      fetchedAt: FETCHED_AT,
    },
  };
}

describe("previewImageFor", () => {
  it("returns a stored preview image when it is a safe HTTPS URL", () => {
    expect(previewImageFor(link("https://cdn.example.com/card.png"))).toBe(
      "https://cdn.example.com/card.png",
    );
  });

  it("refuses stored images on private, internal or non-443 hosts", () => {
    for (const image of [
      "https://127.0.0.1/card.png",
      "https://printer.internal/card.png",
      "https://cdn.example.com:8443/card.png",
      "http://cdn.example.com/card.png",
    ]) {
      expect(previewImageFor(link(image)), image).toBe("");
    }
  });
});
