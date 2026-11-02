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
    dialog.locator("form").locator(`img[src="${IMAGES.article}"]`),
  ).toBeVisible();

  await dialog.locator("#link-title").fill("My custom title");
  await dialog.locator("#link-description").fill("My custom note");

  await fillUrlAndWaitForPreview(page, dialog, SECOND_URL);
  await expect(dialog.locator("#link-title")).toHaveValue("My custom title");
  await expect(dialog.locator("#link-description")).toHaveValue(
    "My custom note",
  );
  await expect(
    dialog.locator("form").locator(`img[src="${IMAGES.second}"]`),
  ).toBeVisible();
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
  await expect(
    dialog.locator("form").locator(`img[src="${IMAGES.manual}"]`),
  ).toBeVisible();
  await expect(dialog.getByText("Page preview", { exact: true })).toHaveCount(
    0,
  );

  await dialog.locator("#link-image").fill("");
  await expect(
    dialog.getByText("Page preview", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.locator("form").locator(`img[src="${IMAGES.article}"]`),
  ).toBeVisible();

  await dialog.locator("#link-use-preview").click();
  await expect(
    dialog.getByText(
      "Page previews are off for this block. The card will use its icon.",
    ),
  ).toBeVisible();
  await expect(
    dialog.locator("form").locator(`img[src="${IMAGES.article}"]`),
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

test("updates the live preview while the block is edited", async ({ page }) => {
  const dialog = await openAddLinkDialog(page);
  const preview = dialog.getByTestId("link-live-preview");

  await expect(preview).toHaveAttribute("data-preview-layout", "classic");
  await dialog.locator("#link-title").fill("Live preview card");
  await expect(preview).toContainText("Live preview card");

  await selectRichLayout(dialog);
  await expect(preview).toHaveAttribute("data-preview-layout", "rich");

  await fillUrlAndWaitForPreview(page, dialog, ARTICLE_URL);
  const draftCard = preview
    .locator("a")
    .filter({ hasText: "Live preview card" });
  await expect(draftCard.locator(`img[src="${IMAGES.article}"]`)).toBeVisible();

  await dialog.locator("#link-image").fill(IMAGES.manual);
  await expect(draftCard.locator(`img[src="${IMAGES.manual}"]`)).toBeVisible();

  await dialog
    .locator('label:has(input[name="link-layout"][value="featured"])')
    .click();
  await expect(preview).toHaveAttribute("data-preview-layout", "featured");

  await dialog.locator("#link-active").click();
  await expect(
    preview.getByText("Inactive — this block stays off your public profile."),
  ).toBeVisible();
  await expect(preview).toContainText("Live preview card");
});

test("previews an existing block while editing", async ({ page }) => {
  await page.goto("/dashboard/links");
  await page
    .getByRole("button", { name: "Edit E2E preview image card" })
    .click();
  const dialog = page.getByRole("dialog");
  const preview = dialog.getByTestId("link-live-preview");

  await expect(preview).toContainText("E2E preview image card");
  await expect(preview.locator(`img[src="${IMAGES.preview}"]`)).toBeVisible();
  await expect(preview).toHaveAttribute("data-preview-layout", "featured");

  await dialog.locator("#link-title").fill("Edited preview card");
  await expect(preview).toContainText("Edited preview card");
  await expect(preview).not.toContainText("E2E preview image card");

  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).toBeHidden();
});

test("keeps form state when switching to the mobile preview", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const dialog = await openAddLinkDialog(page);

  await dialog.locator("#link-title").fill("Mobile preview card");
  await dialog.getByRole("button", { name: "Preview", exact: true }).click();

  const preview = dialog.getByTestId("link-live-preview");
  await expect(preview).toBeVisible();
  await expect(preview).toContainText("Mobile preview card");

  await dialog.getByRole("button", { name: "Fields", exact: true }).click();
  await expect(dialog.locator("#link-title")).toHaveValue("Mobile preview card");
});
