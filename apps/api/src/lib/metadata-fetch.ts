import { normalizeUrl, type LinkMetadata } from "@linkhub/shared";
import { env } from "../config/env";
import { fail } from "./errors";
import {
  emptyMetadataFor,
  fetchLinkMetadata,
  MetadataFetchError,
} from "./metadata-fetcher";
import { fetchableUrlError } from "./url-safety";

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;
const BUDGET_WINDOW_MS = 60_000;
const BUDGET_LIMIT = 20;
const MAX_CONCURRENT_FETCHES = 4;
const QUEUE_TIMEOUT_MS = 15_000;
/**
 * Hard cap for a fetch that runs as part of a save. It is intentionally
 * shorter than the normal request timeout and never waits behind the queue.
 */
const SAVE_TIME_TIMEOUT_MS = 3_000;

interface CacheEntry {
  metadata: LinkMetadata;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<LinkMetadata>>();
const budgets = new Map<string, number[]>();
let nextBudgetPruneAt = 0;

function cacheKey(userId: string, normalizedUrl: string): string {
  return `${userId}:${normalizedUrl}`;
}

function cachedMetadata(key: string): LinkMetadata | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return { ...entry.metadata };
}

function storeMetadata(key: string, metadata: LinkMetadata): void {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, {
    metadata: { ...metadata },
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

/**
 * Drop users whose whole window has expired. Without this the map grows with
 * every user who ever previewed a link, even though their budget is unusable.
 */
function pruneExpiredBudgets(now: number): void {
  if (now < nextBudgetPruneAt) return;
  nextBudgetPruneAt = now + BUDGET_WINDOW_MS;
  for (const [userId, timestamps] of budgets) {
    const last = timestamps[timestamps.length - 1];
    if (last === undefined || now - last >= BUDGET_WINDOW_MS) {
      budgets.delete(userId);
    }
  }
}

/** Programmatic budget shared by preview, refresh and save-time fetches. */
function consumeBudget(userId: string): void {
  const now = Date.now();
  pruneExpiredBudgets(now);
  const recent = (budgets.get(userId) ?? []).filter(
    (timestamp) => now - timestamp < BUDGET_WINDOW_MS,
  );
  if (recent.length >= BUDGET_LIMIT) {
    throw fail.rateLimited(
      "You can fetch up to 20 link previews per minute. Try again shortly.",
    );
  }
  recent.push(now);
  budgets.set(userId, recent);
}

let activeFetches = 0;
const waiters: Array<{
  resolve: () => void;
  reject: (error: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
}> = [];

async function withFetchSlot<T>(operation: () => Promise<T>): Promise<T> {
  if (activeFetches >= MAX_CONCURRENT_FETCHES) {
    await new Promise<void>((resolve, reject) => {
      const waiter = {
        resolve,
        reject,
        timer: setTimeout(() => {
          const index = waiters.indexOf(waiter);
          if (index !== -1) waiters.splice(index, 1);
          reject(
            fail.metadataUnavailable(
              "Preview requests are busy right now. Try again shortly.",
            ),
          );
        }, QUEUE_TIMEOUT_MS),
      };
      waiters.push(waiter);
    });
  } else {
    activeFetches += 1;
  }

  try {
    return await operation();
  } finally {
    activeFetches -= 1;
    const next = waiters.shift();
    if (next) {
      clearTimeout(next.timer);
      activeFetches += 1;
      next.resolve();
    }
  }
}

export function isMetadataFetchEnabled(): boolean {
  return env.METADATA_FETCH_ENABLED;
}

/**
 * Skip entries are either exact registrable hosts (`instagram.com`, which also
 * covers subdomains) or a wildcard final label (`amazon.*`, `amzn.*`). The
 * wildcard allows one- and two-label public suffixes (`amazon.com`,
 * `amazon.co.uk`) while still rejecting a host such as `amazon.com.evil.com`.
 */
function matchesSkipHost(host: string, candidate: string): boolean {
  if (candidate.endsWith(".*")) {
    const base = candidate.slice(0, -2);
    if (!base || base.includes("*")) return false;
    const labels = host.split(".");
    const index = labels.indexOf(base);
    if (index === -1) return false;
    const suffixLabels = labels.length - index - 1;
    return suffixLabels >= 1 && suffixLabels <= 2;
  }
  return host === candidate || host.endsWith(`.${candidate}`);
}

export function isSkippedMetadataHost(rawUrl: string): boolean {
  const normalized = normalizeUrl(rawUrl);
  if (!normalized) return false;
  const host = new URL(normalized).hostname.toLowerCase().replace(/\.$/, "");
  return env.metadataSkipHosts.some((candidate) =>
    matchesSkipHost(host, candidate),
  );
}

interface FetchMetadataOptions {
  force?: boolean;
  /**
   * Save-time fetches are best-effort: they use a hard 3 s cap, never wait for
   * a concurrency slot, and never join an existing in-flight preview request.
   */
  saveTime?: boolean;
}

/**
 * Fetches (or reuses) preview metadata for one user.
 *
 * The 10-minute cache is keyed by user + normalised URL, in-flight requests
 * are deduplicated, and the 20/min budget counts real network fetches only.
 */
export async function fetchMetadataForUser(
  userId: string,
  rawUrl: string,
  options: FetchMetadataOptions = {},
): Promise<LinkMetadata> {
  const normalized = normalizeUrl(rawUrl);
  if (!normalized) {
    throw fail.validation("Enter a valid http(s) URL.");
  }

  const blocked = fetchableUrlError(new URL(normalized));
  if (blocked) throw fail.validation(blocked);

  if (isSkippedMetadataHost(normalized)) {
    return emptyMetadataFor(normalized);
  }
  if (!isMetadataFetchEnabled()) {
    throw fail.metadataDisabled();
  }

  const key = cacheKey(userId, normalized);
  if (!options.force) {
    const cached = cachedMetadata(key);
    if (cached) return cached;
  }

  if (options.saveTime) {
    // Never wait for a queue slot on the save path. If the fetch pool is busy,
    // skip metadata rather than delaying the response.
    if (activeFetches >= MAX_CONCURRENT_FETCHES) {
      throw fail.metadataUnavailable(
        "Preview requests are busy right now. Try again shortly.",
      );
    }

    consumeBudget(userId);
    const metadata = await withFetchSlot(() =>
      fetchLinkMetadata(normalized, {
        signal: AbortSignal.timeout(SAVE_TIME_TIMEOUT_MS),
      }),
    );
    storeMetadata(key, metadata);
    return metadata;
  }

  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    consumeBudget(userId);
    const metadata = await withFetchSlot(() => fetchLinkMetadata(normalized));
    storeMetadata(key, metadata);
    return metadata;
  })().finally(() => {
    inFlight.delete(key);
  });

  inFlight.set(key, promise);
  return promise;
}

/**
 * Maps fetcher failures to the API's stable error envelope.
 *
 * A destination that cannot be read or times out is a 502, not a 422: the
 * request and URL are valid, and the upstream page is at fault. Only input
 * that must never be fetched (blocked or invalid) is a 400.
 */
export function metadataFetchFailure(error: unknown): never {
  if (error instanceof MetadataFetchError) {
    if (error.kind === "blocked" || error.kind === "invalid") {
      throw fail.validation(error.message);
    }
    if (error.kind === "timeout") {
      throw fail.metadataUnavailable(
        "The destination took too long to respond.",
      );
    }
    throw fail.metadataUnavailable(error.message);
  }
  throw error;
}

/** Test-only reset; production processes never call this. */
export function resetMetadataFetchStateForTests(): void {
  cache.clear();
  inFlight.clear();
  budgets.clear();
  nextBudgetPruneAt = 0;
}

/** Test-only inspection; production code never calls this. */
export function metadataFetchBudgetUsersForTests(): number {
  return budgets.size;
}
