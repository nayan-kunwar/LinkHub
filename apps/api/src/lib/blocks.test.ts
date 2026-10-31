import { describe, expect, it } from "vitest";
import {
  appearanceSchema,
  contactConfigSchema,
  defaultConfigFor,
  detectProvider,
  linkConfigSchema,
  linkFormSchema,
  parseLinkConfig,
  parseYouTubeId,
  toBlock,
  type Link,
} from "@linkhub/shared";
import {
  createLinkApiSchema,
  updateLinkApiSchema,
} from "../modules/links/links.schema";

function link(overrides: Partial<Link> = {}): Link {
  return {
    id: "a1000000-0000-4000-8000-000000000001",
    title: "Example",
    url: "https://example.com",
    type: "link",
    config: {},
    description: "",
    categoryId: null,
    icon: "auto",
    isActive: true,
    sortOrder: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("block config", () => {
  it("treats old links as classic links with default config", () => {
    const block = toBlock(link());
    expect(block?.type).toBe("link");
    expect(block?.config).toEqual({
      layout: "classic",
      subtitle: "",
      imageUrl: "",
    });
  });

  it("falls back to link when the stored type is unknown", () => {
    const block = toBlock(link({ type: "unknown" as Link["type"] }));
    expect(block?.type).toBe("link");
  });

  it("returns null when a stored config is unusable", () => {
    expect(toBlock(link({ type: "youtube", url: "https://youtube.com/watch?v=abc", config: {} }))).toBeNull();
  });

  it("parses stored configs without throwing", () => {
    expect(parseLinkConfig("link", null)).toEqual({
      layout: "classic",
      subtitle: "",
      imageUrl: "",
    });
    expect(parseLinkConfig("nope", {})).toEqual({});
    expect(defaultConfigFor("header")).toEqual({ subtitle: "" });
  });

  it("requires at least one contact method", () => {
    expect(contactConfigSchema.safeParse({}).success).toBe(false);
    expect(contactConfigSchema.safeParse({ email: "you@example.com" }).success).toBe(true);
  });

  it("rejects unknown config keys", () => {
    expect(linkConfigSchema.safeParse({ layout: "rich", extra: true }).success).toBe(false);
  });
});

describe("YouTube URL parsing", () => {
  it("accepts the usual watch, short and embed forms", () => {
    expect(parseYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeId("https://youtu.be/dQw4w9WgXcQ?t=10")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeId("https://youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("rejects other hosts, http and malformed ids", () => {
    expect(parseYouTubeId("http://youtube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(parseYouTubeId("https://example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(parseYouTubeId("https://youtu.be/short")).toBeNull();
  });
});

describe("provider detection", () => {
  it("labels known providers and ignores everything else", () => {
    expect(detectProvider("https://open.spotify.com/track/1")?.label).toBe("Spotify");
    expect(detectProvider("https://www.instagram.com/p/abc")?.label).toBe("Instagram");
    expect(detectProvider("https://example.com")?.label).toBeUndefined();
  });
});

describe("appearance compatibility", () => {
  it("fills layout and font for stored profiles created before Release 1", () => {
    const parsed = appearanceSchema.parse({
      theme: "solid-pink",
      color: "#be185d",
      background: "solid",
      card: "pill",
      button: "brand",
      showAvatar: true,
      showBio: true,
      showSocial: true,
      showDescription: false,
    });
    expect(parsed.theme).toBe("solid-pink");
    expect(parsed.color).toBe("#be185d");
    expect(parsed.layout).toBe("grouped");
    expect(parsed.font).toBe("sans");
  });

  it("rejects unknown fonts and layouts", () => {
    expect(
      appearanceSchema.safeParse({
        theme: "default",
        color: "#7c3aed",
        background: "gradient",
        card: "rounded",
        button: "solid",
        layout: "masonry",
        font: "comic",
        showAvatar: true,
        showBio: true,
        showSocial: true,
        showDescription: false,
      }).success,
    ).toBe(false);
  });
});

describe("link form validation", () => {
  it("accepts a header with no URL", () => {
    const parsed = linkFormSchema.safeParse({
      type: "header",
      title: "Work links",
      url: "",
      categoryId: null,
      description: "",
      icon: "auto",
      isActive: true,
      config: { subtitle: "Selected projects" },
    });
    expect(parsed.success).toBe(true);
  });

  it("requires a YouTube URL for the youtube block", () => {
    const parsed = linkFormSchema.safeParse({
      type: "youtube",
      title: "Watch",
      url: "https://example.com/video",
      categoryId: null,
      description: "",
      icon: "auto",
      isActive: true,
      config: { videoId: "" },
    });
    expect(parsed.success).toBe(false);
  });

  it("requires contact details for the contact block", () => {
    const parsed = linkFormSchema.safeParse({
      type: "contact",
      title: "Contact",
      url: "",
      categoryId: null,
      description: "",
      icon: "auto",
      isActive: true,
      config: { email: "", phone: "", whatsapp: "" },
    });
    expect(parsed.success).toBe(false);
  });
});

describe("API link schemas", () => {
  it("keeps old clients working by defaulting to a link", () => {
    const parsed = createLinkApiSchema.parse({
      title: "Old client",
      url: "https://example.com",
    });
    expect(parsed.type).toBe("link");
  });

  it("rejects a URL on a header block", () => {
    expect(
      createLinkApiSchema.safeParse({
        type: "header",
        title: "Heading",
        url: "https://example.com",
      }).success,
    ).toBe(false);
  });

  it("does not accept type changes on update", () => {
    expect(
      updateLinkApiSchema.safeParse({ type: "header", title: "New" }).success,
    ).toBe(false);
  });

  it("accepts config-only updates", () => {
    const parsed = updateLinkApiSchema.parse({
      config: { layout: "rich", subtitle: "New", imageUrl: "" },
    });
    expect(parsed.config).toEqual({
      layout: "rich",
      subtitle: "New",
      imageUrl: "",
    });
  });
});
