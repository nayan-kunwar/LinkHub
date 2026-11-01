import { expect, test } from "@playwright/test";
import {
  ARTICLE_URL,
  INSTAGRAM_URL,
  SECOND_URL,
  fillUrlAndWaitForPreview,
  login,
  mockLinkMetadata,
  mockRemoteAssets,
  openAddLinkDialog,
  selectRichLayout,
} from "./helpers";
import { IMAGES } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await mockLinkMetadata(page);
  await mockRemoteAssets(page);
  await login(page);
});

test("fetches a preview on blur and never overwrites typed text", async ({
  page,
}) => {
  const dialog = await openAddLinkDialog(page);
  await selectRichLayout(dialog);

  await fillUrlAndWaitForPreview(page, dialog, ARTICLE_URL);
  await expect(dialog.locator("#link-title")).toHaveValue(
    "Mocked preview title",
  );
  await expect(dialog.locator("#link-description")).toHaveValue(
    "Mocked preview description.",
  );
  await expect(
    dialog.locator(`img[src="${IMAGES.article}"]`),
  ).toBeVisible();

  await dialog.locator("#link-title").fill("My custom title");
  await dialog.locator("#link-description").fill("My custom note");

  await fillUrlAndWaitForPreview(page, dialog, SECOND_URL);
  await expect(dialog.locator("#link-title")).toHaveValue("My custom title");
  await expect(dialog.locator("#link-description")).toHaveValue(
    "My custom note",
  );
  await expect(dialog.locator(`img[src="${IMAGES.second}"]`)).toBeVisible();
});

test("manual image and preview opt-out both take precedence", async ({
  page,
}) => {
  const dialog = await openAddLinkDialog(page);
  await selectRichLayout(dialog);
  await fillUrlAndWaitForPreview(page, dialog, ARTICLE_URL);

  await dialog.locator("#link-image").fill(IMAGES.manual);
  await expect(
    dialog.getByText("Manual image — always wins over the page preview."),
  ).toBeVisible();
  await expect(dialog.locator(`img[src="${IMAGES.manual}"]`)).toBeVisible();
  await expect(dialog.getByText("Page preview", { exact: true })).toHaveCount(
    0,
  );

  await dialog.locator("#link-image").fill("");
  await expect(
    dialog.getByText("Page preview", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.locator(`img[src="${IMAGES.article}"]`),
  ).toBeVisible();

  await dialog.locator("#link-use-preview").click();
  await expect(
    dialog.getByText(
      "Page previews are off for this block. The card will use its icon.",
    ),
  ).toBeVisible();
  await expect(
    dialog.locator(`img[src="${IMAGES.article}"]`),
  ).toHaveCount(0);

  await dialog.locator("#link-use-preview").click();
  await expect(
    dialog.getByText("Page preview", { exact: true }),
  ).toBeVisible();

  await fillUrlAndWaitForPreview(page, dialog, INSTAGRAM_URL);
  await expect(
    dialog.getByText(/Instagram often blocks previews/),
  ).toBeVisible();
});

test("saves a rich block without calling the metadata fetcher", async ({
  page,
}) => {
  const dialog = await openAddLinkDialog(page);
  await selectRichLayout(dialog);
  await fillUrlAndWaitForPreview(page, dialog, ARTICLE_URL);

  await dialog.locator("#link-title").fill("E2E editor saved card");
  await dialog.locator("#link-description").fill("Saved by the editor test.");

  const created = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/links") &&
      response.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "Add block", exact: true }).click();
  const createdResponse = await created;
  expect(createdResponse.status()).toBe(201);
  const payload = (await createdResponse.json()) as {
    data: { metadata: { sourceUrl: string }; previewImageUrl: string };
  };
  // The E2E API runs with METADATA_FETCH_ENABLED=false, so saving must not
  // perform an outbound metadata fetch.
  expect(payload.data.metadata.sourceUrl).toBe("");
  expect(payload.data.previewImageUrl).toBe("");

  await expect(dialog).toBeHidden();
  await expect(page.getByText("E2E editor saved card").first()).toBeVisible();
});
