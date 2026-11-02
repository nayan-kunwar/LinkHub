import { describe, expect, it } from "vitest";
import {
  fetchableUrlError,
  isBlockedHostname,
  isBlockedIp,
  previewImageUrlError,
} from "./url-safety";

function errorFor(value: string): string | null {
  return fetchableUrlError(new URL(value));
}

describe("SSRF address checks", () => {
  it("blocks private, loopback, link-local and CGNAT IPv4 ranges", () => {
    for (const address of [
      "0.0.0.0",
      "10.1.2.3",
      "100.64.0.1",
      "127.0.0.1",
      "169.254.169.254",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "192.0.2.10",
      "198.18.0.1",
      "198.51.100.1",
      "203.0.113.1",
      "224.0.0.1",
      "255.255.255.255",
    ]) {
      expect(isBlockedIp(address), address).toBe(true);
    }
  });

  it("allows public IPv4 addresses", () => {
    expect(isBlockedIp("8.8.8.8")).toBe(false);
    expect(isBlockedIp("1.1.1.1")).toBe(false);
    expect(isBlockedIp("172.32.0.1")).toBe(false);
  });

  it("blocks loopback, ULA, link-local, mapped, NAT64, 6to4 and Teredo", () => {
    for (const address of [
      "::",
      "::1",
      "fc00::1",
      "fd12:3456::1",
      "fe80::1",
      "fec0::1",
      "feff::1",
      "::ffff:127.0.0.1",
      "::ffff:8.8.8.8",
      "64:ff9b::1",
      "2002:7f00:1::",
      "2001::1",
      "2001:db8::1",
      "ff02::1",
    ]) {
      expect(isBlockedIp(address), address).toBe(true);
    }
  });

  it("allows public IPv6 addresses", () => {
    expect(isBlockedIp("2606:4700:4700::1111")).toBe(false);
    expect(isBlockedIp("2001:4860:4860::8888")).toBe(false);
    // Outside both the fe80::/10 link-local and fec0::/10 site-local masks.
    expect(isBlockedIp("fe7f::1")).toBe(false);
  });
});

describe("SSRF URL checks", () => {
  it("rejects credentials and non-http schemes", () => {
    expect(errorFor("https://user:pass@example.com/")).toMatch(/credentials/i);
    expect(errorFor("ftp://example.com/file")).toMatch(/http/i);
    expect(errorFor("mailto:hi@example.com")).toMatch(/http/i);
  });

  it("rejects non-standard ports", () => {
    expect(errorFor("http://example.com:8080/")).toMatch(/ports/i);
    expect(errorFor("https://example.com:8443/")).toMatch(/ports/i);
    expect(errorFor("https://example.com:443/")).toBeNull();
    expect(errorFor("http://example.com:80/")).toBeNull();
  });

  it("rejects local and reserved hostnames", () => {
    for (const value of [
      "http://localhost/",
      "http://app.localhost/",
      "http://printer.local/",
      "http://metadata.google.internal/",
      "http://instance-data/",
      "http://intranet/",
    ]) {
      expect(errorFor(value), value).not.toBeNull();
    }
    expect(isBlockedHostname("localhost")).toBe(true);
    expect(isBlockedHostname("example.com")).toBe(false);
  });

  it("rejects literal private addresses even when the URL parser normalises them", () => {
    expect(errorFor("http://127.0.0.1/")).toMatch(/private|reserved/i);
    expect(errorFor("http://2130706433/")).toMatch(/private|reserved/i);
    expect(errorFor("http://0x7f000001/")).toMatch(/private|reserved/i);
    expect(errorFor("http://[::1]/")).toMatch(/private|reserved/i);
    expect(errorFor("http://[::ffff:127.0.0.1]/")).toMatch(/private|reserved/i);
    expect(errorFor("http://[64:ff9b::1]/")).toMatch(/private|reserved/i);
  });

  it("allows ordinary public destinations", () => {
    expect(errorFor("https://example.com/article")).toBeNull();
    expect(errorFor("http://example.com:80/")).toBeNull();
    expect(errorFor("https://8.8.8.8/")).toBeNull();
    expect(errorFor("https://[2606:4700:4700::1111]/")).toBeNull();
  });
});

describe("preview image URL checks", () => {
  it("requires HTTPS on port 443 and a public host", () => {
    expect(
      previewImageUrlError(new URL("https://cdn.example.com/card.png")),
    ).toBeNull();
    expect(
      previewImageUrlError(new URL("https://cdn.example.com:443/card.png")),
    ).toBeNull();
    expect(
      previewImageUrlError(new URL("http://cdn.example.com/card.png")),
    ).toMatch(/https/i);
    expect(
      previewImageUrlError(new URL("https://cdn.example.com:8443/card.png")),
    ).toMatch(/443/);
    expect(
      previewImageUrlError(new URL("https://127.0.0.1/card.png")),
    ).toMatch(/private|reserved/i);
    expect(
      previewImageUrlError(new URL("https://printer.internal/card.png")),
    ).toMatch(/private|reserved/i);
  });
});
