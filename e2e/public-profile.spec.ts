import { expect, test } from "@playwright/test";
import { readFixtures, IMAGES } from "./fixtures";
import { mockRemoteAssets } from "./helpers";

test.beforeEach(async ({ page }) => {
  await mockRemoteAssets(page);
});

test("renders manual and stored preview images with safe image attributes", async ({
  page,
}) => {
  const { username } = readFixtures();
  await page.goto(`/${username}`);

  const manualCard = page.locator("a", { hasText: "E2E manual image card" });
  await expect(manualCard).toBeVisible();
  const manualImage = manualCard.locator("img");
  await expect(manualImage).toHaveAttribute("src", IMAGES.manual);
  await expect(manualImage).toHaveAttribute("loading", "lazy");
  await expect(manualImage).toHaveAttribute("decoding", "async");
  await expect(manualImage).toHaveAttribute("referrerpolicy", "no-referrer");

  const previewCard = page.locator("a", {
    hasText: "E2E preview image card",
  });
  await expect(previewCard).toBeVisible();
  const previewImage = previewCard.locator("img");
  await expect(previewImage).toHaveAttribute("src", IMAGES.preview);
  await expect(previewImage).toHaveAttribute("loading", "lazy");
  await expect(previewImage).toHaveAttribute("referrerpolicy", "no-referrer");
});

test("does not render an image when the preview opt-out is set", async ({
  page,
}) => {
  const { username } = readFixtures();
  await page.goto(`/${username}`);

  const optOutCard = page.locator("a", {
    hasText: "E2E preview opt-out card",
  });
  await expect(optOutCard).toBeVisible();
  await expect(optOutCard.locator(`img[src="${IMAGES.ignored}"]`)).toHaveCount(
    0,
  );
  await expect(optOutCard.locator("img")).toHaveCount(0);
  await expect(optOutCard.locator("svg")).not.toHaveCount(0);
});

test("public API exposes previewImageUrl and omits stored metadata", async ({
  request,
}) => {
  const { username } = readFixtures();
  const response = await request.get(`/api/v1/public/profiles/${username}`);
  expect(response.status()).toBe(200);

  const payload = (await response.json()) as {
    data: {
      links: Array<{
        id: string;
        title: string;
        previewImageUrl: string;
        metadata?: unknown;
      }>;
    };
  };

  const manual = payload.data.links.find(
    (link) => link.title === "E2E manual image card",
  );
  const preview = payload.data.links.find(
    (link) => link.title === "E2E preview image card",
  );
  const optOut = payload.data.links.find(
    (link) => link.title === "E2E preview opt-out card",
  );

  expect(manual?.previewImageUrl).toBe(IMAGES.manual);
  expect(preview?.previewImageUrl).toBe(IMAGES.preview);
  expect(optOut?.previewImageUrl).toBe("");
  for (const link of payload.data.links) {
    expect(link).not.toHaveProperty("metadata");
  }
});
