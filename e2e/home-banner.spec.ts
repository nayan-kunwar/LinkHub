import { expect, test } from "@playwright/test";

test("development banner appears on the home page", async ({ page }) => {
  await page.goto("/");

  const banner = page.getByTestId("development-banner");
  await expect(banner).toBeVisible();
  await expect(banner).toContainText("Link Hub is in development.");
  await expect(banner).toContainText("Some features may change or be unavailable.");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(banner).toBeVisible();
});

test("development banner stays off the login page", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByTestId("development-banner")).toHaveCount(0);
});
