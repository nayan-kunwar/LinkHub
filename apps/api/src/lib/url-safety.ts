import { isIP } from "node:net";

/**
 * SSRF defence for server-side preview fetches.
 *
 * URL validation happens before every request and before every redirect, and
 * the same checks run again on every address returned by the custom DNS
 * lookup used by the pinned undici agent.
 */

function parseIpv4(value: string): Uint8Array | null {
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const bytes = new Uint8Array(4);
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (!/^\d{1,3}$/.test(part)) return null;
    const number = Number(part);
    if (number > 255) return null;
    bytes[index] = number;
  }
  return bytes;
}

function parseIpv6(raw: string): Uint8Array | null {
  let value = raw.trim().toLowerCase();
  if (value.startsWith("[") && value.endsWith("]")) value = value.slice(1, -1);
  const zone = value.indexOf("%");
  if (zone !== -1) value = value.slice(0, zone);
  if (!value.includes(":")) return null;

  const doubleColon = value.indexOf("::");
  if (doubleColon !== -1 && value.indexOf("::", doubleColon + 1) !== -1) {
    return null;
  }

  const head = doubleColon === -1 ? value : value.slice(0, doubleColon);
  const tail = doubleColon === -1 ? "" : value.slice(doubleColon + 2);

  const parseParts = (source: string, allowIpv4: boolean): number[] | null => {
    if (!source) return [];
    const result: number[] = [];
    const parts = source.split(":");
    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index];
      if (!part) return null;
      if (part.includes(".")) {
        if (!allowIpv4 || index !== parts.length - 1) return null;
        const ipv4 = parseIpv4(part);
        if (!ipv4) return null;
        result.push((ipv4[0] << 8) | ipv4[1], (ipv4[2] << 8) | ipv4[3]);
        continue;
      }
      if (!/^[0-9a-f]{1,4}$/.test(part)) return null;
      result.push(Number.parseInt(part, 16));
    }
    return result;
  };

  const headValues = parseParts(head, doubleColon === -1);
  if (!headValues) return null;
  const tailValues = parseParts(tail, true);
  if (!tailValues) return null;

  const missing = 8 - headValues.length - tailValues.length;
  if (doubleColon === -1) {
    if (missing !== 0) return null;
  } else if (missing < 1) {
    return null;
  }

  const words = [
    ...headValues,
    ...new Array(Math.max(0, missing)).fill(0),
    ...tailValues,
  ];
  const bytes = new Uint8Array(16);
  for (let index = 0; index < words.length; index += 1) {
    bytes[index * 2] = words[index] >> 8;
    bytes[index * 2 + 1] = words[index] & 0xff;
  }
  return bytes;
}

function isBlockedIpv4(bytes: Uint8Array): boolean {
  const [a, b, c] = bytes;

  // "This network", private, loopback, link-local and CGNAT ranges.
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;

  // IETF protocol assignments, documentation, benchmarking and 6to4 relay.
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true;
  if (a === 192 && b === 88 && c === 99) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;

  // Multicast and the reserved 240/4 block (includes 255.255.255.255).
  return a >= 224;
}

function isBlockedIpv6(bytes: Uint8Array): boolean {
  const allZero = bytes.every((byte) => byte === 0);
  if (allZero) return true;
  if (
    bytes.slice(0, 15).every((byte) => byte === 0) &&
    bytes[15] === 1
  ) {
    return true;
  }

  const firstWord = (bytes[0] << 8) | bytes[1];
  const secondWord = (bytes[2] << 8) | bytes[3];

  // IPv4-compatible (::/96) and IPv4-mapped (::ffff:0:0/96).
  if (bytes.slice(0, 12).every((byte) => byte === 0)) return true;
  if (
    bytes.slice(0, 10).every((byte) => byte === 0) &&
    bytes[10] === 0xff &&
    bytes[11] === 0xff
  ) {
    return true;
  }

  // NAT64 well-known prefix (64:ff9b::/96) and local-use prefix.
  if (firstWord === 0x0064 && secondWord === 0xff9b) return true;

  // 6to4 (2002::/16).
  if (firstWord === 0x2002) return true;

  // Teredo and the rest of the IANA 2001::/23 special-purpose block.
  if (firstWord === 0x2001 && secondWord <= 0x01ff) return true;

  // Documentation, ORCHID, discard-only, segment routing.
  if (firstWord === 0x2001 && secondWord === 0x0db8) return true;
  if (firstWord === 0x3fff && secondWord <= 0x0fff) return true;
  if (firstWord === 0x0100) return true;
  if (firstWord === 0x5f00) return true;

  // Unique-local, link-local, deprecated site-local (fec0::/10) and multicast.
  if ((bytes[0] & 0xfe) === 0xfc) return true;
  if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) return true;
  if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0xc0) return true;
  if (bytes[0] === 0xff) return true;

  return false;
}

export function isBlockedIp(value: string): boolean {
  const address = value.trim().replace(/^\[|\]$/g, "");
  const version = isIP(address);
  if (version === 4) {
    const bytes = parseIpv4(address);
    return bytes ? isBlockedIpv4(bytes) : true;
  }
  if (version === 6) {
    const bytes = parseIpv6(address);
    return bytes ? isBlockedIpv6(bytes) : true;
  }
  return false;
}

const BLOCKED_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".home",
  ".lan",
  ".corp",
  ".localdomain",
  ".test",
  ".invalid",
  ".example",
];

const BLOCKED_HOSTS = new Set([
  "localhost",
  "metadata",
  "metadata.google.internal",
  "metadata.goog",
  "instance-data",
  "instance-data.ec2.internal",
]);

export function isBlockedHostname(hostname: string): boolean {
  const host = hostname
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");
  if (!host) return true;
  if (BLOCKED_HOSTS.has(host)) return true;
  if (BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true;
  // Single-label names resolve through internal search domains in most
  // container platforms, so they are never valid public destinations.
  return !host.includes(".");
}

/**
 * Returns a human-readable reason when a URL must not be fetched, or null.
 * Redirects call this again with the new target.
 */
export function fetchableUrlError(url: URL): string | null {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return "Only http:// and https:// URLs can be previewed.";
  }
  if (url.username || url.password) {
    return "URLs with embedded credentials cannot be previewed.";
  }
  if (url.port && url.port !== "80" && url.port !== "443") {
    return "Only ports 80 and 443 can be previewed.";
  }

  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host) return "Enter a URL with a hostname.";
  if (isIP(host)) {
    return isBlockedIp(host)
      ? "This URL points to a private or reserved address."
      : null;
  }
  if (isBlockedHostname(host)) {
    return "This URL points to a private or reserved host.";
  }
  return null;
}

/**
 * Remote preview images are stricter than page fetches: HTTPS only, on the
 * default port, and still subject to the same private/reserved host checks.
 */
export function previewImageUrlError(url: URL): string | null {
  if (url.protocol !== "https:") {
    return "Preview images must use https://.";
  }
  if (url.username || url.password) {
    return "Preview image URLs cannot include credentials.";
  }
  if (url.port && url.port !== "443") {
    return "Preview images must use port 443.";
  }
  return fetchableUrlError(url);
}

export function isFetchableUrl(url: URL): boolean {
  return fetchableUrlError(url) === null;
}
