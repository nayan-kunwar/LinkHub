import { expect, type Locator, type Page } from "@playwright/test";
import { ownerEmail, ownerPassword } from "./env";
import { IMAGES } from "./fixtures";

export const ARTICLE_URL = "https://example.com/article";
export const SECOND_URL = "https://example.com/second";
export const INSTAGRAM_URL = "https://www.instagram.com/";

const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

export interface PreviewMetadata {
  sourceUrl: string;
  finalUrl: string;
  title: string;
  description: string;
  imageUrl: string;
  siteName: string;
  fetchedAt: string;
}

export function metadataFor(
  sourceUrl: string,
  overrides: Partial<PreviewMetadata> = {},
): PreviewMetadata {
  return {
    sourceUrl,
    finalUrl: sourceUrl,
    title: "Mocked preview title",
    description: "Mocked preview description.",
    imageUrl: "",
    siteName: "Example",
    fetchedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const MOCK_METADATA: Record<string, PreviewMetadata> = {
  [ARTICLE_URL]: metadataFor(ARTICLE_URL, {
    title: "Mocked preview title",
    description: "Mocked preview description.",
    imageUrl: IMAGES.article,
  }),
  [SECOND_URL]: metadataFor(SECOND_URL, {
    title: "Second mocked title",
    description: "Second mocked description.",
    imageUrl: IMAGES.second,
  }),
  [INSTAGRAM_URL]: metadataFor(INSTAGRAM_URL),
};

/** Keeps the editor deterministic and fully offline. */
export async function mockLinkMetadata(page: Page): Promise<void> {
  await page.route("**/api/v1/links/metadata", async (route) => {
    const body = route.request().postDataJSON() as { url?: string };
    const url = body.url ?? "";
    const data = MOCK_METADATA[url] ?? metadataFor(url);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data }),
    });
  });
}

/** Fulfils every external image/frame the public cards can request. */
export async function mockRemoteAssets(page: Page): Promise<void> {
  await page.route("https://images.example.test/**", (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: TINY_PNG }),
  );
  await page.route("https://i.ytimg.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: TINY_PNG }),
  );
  await page.route("https://www.youtube-nocookie.com/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><title>Mock player</title>",
    }),
  );
}

export async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.locator("#email").fill(ownerEmail());
  await page.locator("#password").fill(ownerPassword());
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/dashboard(?:$|[/?#])/);
}

export async function openAddLinkDialog(page: Page): Promise<Locator> {
  await page.goto("/dashboard/links");
  await page.getByRole("button", { name: "Add link", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /^Link\b/ }).click();
  return dialog;
}

export async function selectRichLayout(dialog: Locator): Promise<void> {
  await dialog
    .locator('label:has(input[name="link-layout"][value="rich"])')
    .click();
  await expect(
    dialog.locator('input[name="link-layout"][value="rich"]'),
  ).toBeChecked();
}

export async function fillUrlAndWaitForPreview(
  page: Page,
  dialog: Locator,
  url: string,
): Promise<void> {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/v1/links/metadata") &&
      response.request().method() === "POST",
  );
  await dialog.locator("#link-url").fill(url);
  await dialog.locator("#link-url").press("Tab");
  const response = await responsePromise;
  expect(response.status()).toBe(200);
}
