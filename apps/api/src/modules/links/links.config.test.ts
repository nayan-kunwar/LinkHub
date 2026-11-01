import { describe, expect, it } from "vitest";
import {
  createLinkApiSchema,
  linkMetadataPreviewApiSchema,
  updateLinkApiSchema,
} from "./links.schema";
import { mergeConfigInput, normaliseConfig } from "./links.config";

describe("link config merge", () => {
  it("keeps fields the client did not send", () => {
    const current = {
      layout: "rich",
      subtitle: "Old subtitle",
      imageUrl: "https://example.com/manual.png",
      usePreviewImage: false,
    };
    const merged = mergeConfigInput(current, { subtitle: "New subtitle" });
    expect(merged).toEqual({
      layout: "rich",
      subtitle: "New subtitle",
      imageUrl: "https://example.com/manual.png",
      usePreviewImage: false,
    });
  });

  it("normalises merged config and fills defaults", () => {
    const merged = mergeConfigInput(
      { layout: "featured", subtitle: "Old" },
      { subtitle: "New" },
    );
    expect(normaliseConfig("link", "https://example.com", merged)).toEqual({
      layout: "featured",
      subtitle: "New",
      imageUrl: "",
      usePreviewImage: true,
    });
  });

  it("derives YouTube config from the URL and ignores a client videoId", () => {
    expect(
      normaliseConfig("youtube", "https://youtu.be/dQw4w9WgXcQ", {
        videoId: "aaaaaaaaaaa",
      }),
    ).toEqual({ videoId: "dQw4w9WgXcQ" });
  });

  it("rejects an unusable config with field paths", () => {
    expect(() =>
      normaliseConfig("link", "https://example.com", {
        layout: "not-a-layout",
      }),
    ).toThrow();
  });
});

describe("link schemas", () => {
  it("strips client-supplied metadata from creates", () => {
    const parsed = createLinkApiSchema.parse({
      type: "link",
      title: "Example",
      url: "https://example.com",
      metadata: {
        sourceUrl: "https://evil.example/",
        title: "Injected",
      },
    });
    expect(parsed).not.toHaveProperty("metadata");
  });

  it("rejects client-supplied metadata on updates", () => {
    expect(
      updateLinkApiSchema.safeParse({ metadata: { title: "Injected" } }).success,
    ).toBe(false);
  });

  it("accepts a preview URL and rejects non-http destinations", () => {
    expect(
      linkMetadataPreviewApiSchema.safeParse({
        url: "https://example.com/article",
      }).success,
    ).toBe(true);
    expect(
      linkMetadataPreviewApiSchema.safeParse({ url: "mailto:hi@example.com" })
        .success,
    ).toBe(false);
    expect(
      linkMetadataPreviewApiSchema.safeParse({
        url: "https://user:pass@example.com/",
      }).success,
    ).toBe(false);
  });
});
