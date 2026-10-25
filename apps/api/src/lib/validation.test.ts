import { describe, expect, it } from "vitest";
import { updateLinkApiSchema } from "../modules/links/links.schema";
import { updateCategoryApiSchema } from "../modules/categories/categories.schema";
import {
  apiUsernameSchema,
  isSafeLinkUrl,
  optionalSafeHttpsUrlSchema,
} from "./validation";

describe("link URL validation", () => {
  it("accepts public http, https and mailto destinations", () => {
    expect(isSafeLinkUrl("https://example.com")).toBe(true);
    expect(isSafeLinkUrl("http://example.com/path?q=1")).toBe(true);
    expect(isSafeLinkUrl("https://sub.example.com:8443/a")).toBe(true);
    expect(isSafeLinkUrl("mailto:hello@example.com")).toBe(true);
  });

  it("rejects non-http schemes and malformed mailto links", () => {
    expect(isSafeLinkUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeLinkUrl("data:text/html,hi")).toBe(false);
    expect(isSafeLinkUrl("file:///etc/passwd")).toBe(false);
    expect(isSafeLinkUrl("mailto:not-an-email")).toBe(false);
  });

  it("rejects localhost, private networks and cloud metadata hosts", () => {
    expect(isSafeLinkUrl("http://localhost/admin")).toBe(false);
    expect(isSafeLinkUrl("http://127.0.0.1")).toBe(false);
    expect(isSafeLinkUrl("http://10.0.0.5")).toBe(false);
    expect(isSafeLinkUrl("http://192.168.1.2")).toBe(false);
    expect(isSafeLinkUrl("http://172.16.0.1")).toBe(false);
    expect(isSafeLinkUrl("http://169.254.169.254/latest/meta-data")).toBe(false);
    expect(isSafeLinkUrl("http://metadata.google.internal")).toBe(false);
    expect(isSafeLinkUrl("http://[::1]/")).toBe(false);
  });

  it("rejects embedded credentials", () => {
    expect(isSafeLinkUrl("https://user:pass@example.com")).toBe(false);
  });
});

describe("avatar URL validation", () => {
  it("only accepts empty or public https URLs", () => {
    expect(optionalSafeHttpsUrlSchema.safeParse("").success).toBe(true);
    expect(optionalSafeHttpsUrlSchema.safeParse("https://cdn.example.com/a.png").success).toBe(
      true,
    );
    expect(optionalSafeHttpsUrlSchema.safeParse("http://example.com/a.png").success).toBe(
      false,
    );
    expect(optionalSafeHttpsUrlSchema.safeParse("https://localhost/a.png").success).toBe(
      false,
    );
  });
});

describe("API username validation", () => {
  it("normalizes and accepts valid usernames", () => {
    expect(apiUsernameSchema.parse("  Nayan-Kunwar ")).toBe("nayan-kunwar");
  });

  it("rejects reserved names at the service layer, not as a generic field error", () => {
    // The API schema intentionally omits the reserved-name refinement so the
    // service can return 409 USERNAME_RESERVED.
    expect(apiUsernameSchema.safeParse("admin").success).toBe(true);
  });

  it("rejects invalid formats", () => {
    expect(apiUsernameSchema.safeParse("ab").success).toBe(false);
    expect(apiUsernameSchema.safeParse("-nayan").success).toBe(false);
    expect(apiUsernameSchema.safeParse("nayan-").success).toBe(false);
    expect(apiUsernameSchema.safeParse("nayan_kunwar").success).toBe(false);
  });
});

describe("partial update schemas", () => {
  it("does not inject create defaults for omitted link fields", () => {
    const parsed = updateLinkApiSchema.parse({ title: "Renamed" });
    expect(parsed).toEqual({ title: "Renamed" });
  });

  it("does not inject create defaults for omitted category fields", () => {
    const parsed = updateCategoryApiSchema.parse({ isVisible: false });
    expect(parsed).toEqual({ isVisible: false });
  });
});
