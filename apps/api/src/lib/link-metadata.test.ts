import { describe, expect, it } from "vitest";
import {
  applyThemePreset,
  EMPTY_LINK_METADATA,
  normalizeUrl,
  parseLinkMetadata,
  THEME_PRESETS,
  type AppearanceSettings,
} from "@linkhub/shared";
import {
  emptyMetadataFor,
  parseMetadataHtml,
} from "./metadata-fetcher";
import { isPreviewEligible } from "../modules/links/link-metadata.service";

const FETCHED_AT = "2026-11-01T12:00:00.000Z";

describe("normalizeUrl", () => {
  it("lower-cases the host, removes default ports and hashes, and keeps path/query", () => {
    expect(
      normalizeUrl("  https://Example.COM:443/a/../b?x=1#section  "),
    ).toBe("https://example.com/b?x=1");
    expect(normalizeUrl("http://example.com:80")).toBe("http://example.com/");
  });

  it("rejects credentials and non-http(s) schemes", () => {
    expect(normalizeUrl("https://user:pass@example.com/")).toBeNull();
    expect(normalizeUrl("ftp://example.com/file")).toBeNull();
    expect(normalizeUrl("mailto:hi@example.com")).toBeNull();
    expect(normalizeUrl("not a url")).toBeNull();
  });

  it("returns the same value for equivalent forms", () => {
    expect(normalizeUrl("https://example.com/a#one")).toBe(
      normalizeUrl("https://example.com/a#two"),
    );
  });
});

describe("parseLinkMetadata", () => {
  it("returns an empty payload for malformed stored rows", () => {
    expect(parseLinkMetadata(null)).toEqual(EMPTY_LINK_METADATA);
    expect(parseLinkMetadata({ title: 42 })).toEqual(EMPTY_LINK_METADATA);
  });

  it("accepts a complete server-owned payload", () => {
    const metadata = {
      sourceUrl: "https://example.com/",
      finalUrl: "https://example.com/",
      title: "Example",
      description: "A description",
      imageUrl: "https://example.com/image.png",
      siteName: "Example",
      fetchedAt: FETCHED_AT,
    };
    expect(parseLinkMetadata(metadata)).toEqual(metadata);
  });
});

describe("parseMetadataHtml", () => {
  it("prefers Open Graph fields and resolves a relative image", () => {
    const html = `
      <html><head>
        <title>Fallback title</title>
        <meta property="og:title" content="OG title">
        <meta property="og:description" content="OG description">
        <meta property="og:image" content="/images/preview.png">
        <meta property="og:site_name" content="Example">
      </head></html>
    `;
    const metadata = parseMetadataHtml(
      html,
      "https://example.com/page",
      "https://example.com/page",
      FETCHED_AT,
    );

    expect(metadata.title).toBe("OG title");
    expect(metadata.description).toBe("OG description");
    expect(metadata.imageUrl).toBe("https://example.com/images/preview.png");
    expect(metadata.siteName).toBe("Example");
    expect(metadata.sourceUrl).toBe("https://example.com/page");
    expect(metadata.finalUrl).toBe("https://example.com/page");
    expect(metadata.fetchedAt).toBe(FETCHED_AT);
  });

  it("falls back to Twitter, description and title tags", () => {
    const html = `
      <html><head>
        <title>Plain title</title>
        <meta name="twitter:description" content="Twitter description">
        <meta name="twitter:image" content="https://cdn.example.com/card.jpg">
      </head></html>
    `;
    const metadata = parseMetadataHtml(
      html,
      "https://example.com/",
      "https://example.com/",
      FETCHED_AT,
    );

    expect(metadata.title).toBe("Plain title");
    expect(metadata.description).toBe("Twitter description");
    expect(metadata.imageUrl).toBe("https://cdn.example.com/card.jpg");
  });

  it("rejects non-HTTPS images and invalid image URLs", () => {
    const httpImage = parseMetadataHtml(
      `<meta property="og:image" content="http://example.com/a.png">`,
      "https://example.com/",
      "https://example.com/",
      FETCHED_AT,
    );
    expect(httpImage.imageUrl).toBe("");

    const dataImage = parseMetadataHtml(
      `<meta property="og:image" content="data:image/png;base64,abc">`,
      "https://example.com/",
      "https://example.com/",
      FETCHED_AT,
    );
    expect(dataImage.imageUrl).toBe("");
  });

  it("drops images on private, internal or non-443 hosts", () => {
    for (const image of [
      "https://127.0.0.1/image.png",
      "https://metadata.google.internal/image.png",
      "https://cdn.example.com:8443/image.png",
    ]) {
      const metadata = parseMetadataHtml(
        `<meta property="og:image" content="${image}">`,
        "https://example.com/",
        "https://example.com/",
        FETCHED_AT,
      );
      expect(metadata.imageUrl, image).toBe("");
    }
  });

  it("keeps useful text when no image is present", () => {
    const metadata = parseMetadataHtml(
      `<meta property="og:title" content="Only text">`,
      "https://example.com/",
      "https://example.com/",
      FETCHED_AT,
    );
    expect(metadata.title).toBe("Only text");
    expect(metadata.imageUrl).toBe("");
  });
});

describe("emptyMetadataFor", () => {
  it("normalises both URLs and leaves fetch fields empty", () => {
    expect(
      emptyMetadataFor("https://Example.com:443/a#hash", "https://example.com/a"),
    ).toEqual({
      sourceUrl: "https://example.com/a",
      finalUrl: "https://example.com/a",
      title: "",
      description: "",
      imageUrl: "",
      siteName: "",
      fetchedAt: null,
    });
  });
});

describe("preview eligibility", () => {
  const base = {
    type: "link",
    url: "https://example.com/article",
    config: { layout: "rich", subtitle: "", imageUrl: "" },
  } as const;

  it("accepts rich and featured links without a manual image", () => {
    expect(isPreviewEligible(base)).toBe(true);
    expect(
      isPreviewEligible({
        ...base,
        config: { ...base.config, layout: "featured" },
      }),
    ).toBe(true);
  });

  it("skips classic links, manual images and the per-link opt-out", () => {
    expect(
      isPreviewEligible({
        ...base,
        config: { ...base.config, layout: "classic" },
      }),
    ).toBe(false);
    expect(
      isPreviewEligible({
        ...base,
        config: {
          ...base.config,
          imageUrl: "https://example.com/manual.png",
        },
      }),
    ).toBe(false);
    expect(
      isPreviewEligible({
        ...base,
        config: { ...base.config, usePreviewImage: false },
      }),
    ).toBe(false);
  });

  it("skips YouTube blocks and invalid URLs", () => {
    expect(isPreviewEligible({ ...base, type: "youtube" })).toBe(false);
    expect(isPreviewEligible({ ...base, url: "mailto:hi@example.com" })).toBe(
      false,
    );
  });
});

describe("applyThemePreset", () => {
  const base: AppearanceSettings = {
    theme: "default",
    color: "#123456",
    background: "solid",
    card: "rounded",
    button: "solid",
    layout: "grouped",
    font: "sans",
    showAvatar: true,
    showBio: true,
    showSocial: true,
    showDescription: false,
  };
  const dark = THEME_PRESETS.find((preset) => preset.id === "dark")!;

  it("preserves a custom accent and background when switching presets", () => {
    const next = applyThemePreset(base, dark);
    expect(next.theme).toBe("dark");
    expect(next.color).toBe("#123456");
    expect(next.background).toBe("solid");
  });

  it("applies the whole preset when it is already active", () => {
    const next = applyThemePreset({ ...base, theme: "dark" }, dark);
    expect(next.color).toBe(dark.accent);
    expect(next.background).toBe("gradient");
  });

  it("applies the whole preset when forced", () => {
    const next = applyThemePreset(base, dark, { force: true });
    expect(next.color).toBe(dark.accent);
    expect(next.background).toBe("gradient");
  });
});
