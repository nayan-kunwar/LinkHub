import { expect, test } from "@playwright/test";
import { login, openAddLinkDialog } from "./helpers";

// Playwright has no swipe helper, so drive Chrome's touch events directly to
// cover the mobile preview's native touch-scrolling path.
test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

test("scrolls the phone preview with touch", async ({ page }) => {
  await login(page);
  const dialog = await openAddLinkDialog(page);
  await dialog.locator("#link-title").fill("Touch preview card");
  await dialog.getByRole("button", { name: "Preview", exact: true }).click();

  const scroller = dialog
    .getByTestId("link-live-preview")
    .locator("[data-phone-scroll]");
  await expect(scroller).toHaveCSS("pointer-events", "auto");

  await scroller.evaluate((element) => element.scrollTo({ top: 0 }));
  const box = await scroller.boundingBox();
  expect(box).not.toBeNull();

  const cdp = await page.context().newCDPSession(page);
  const x = box!.x + box!.width / 2;
  const startY = box!.y + box!.height - 30;
  const endY = box!.y + 30;

  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y: startY }],
  });
  for (let step = 1; step <= 10; step += 1) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: startY + ((endY - startY) * step) / 10 }],
    });
    await page.waitForTimeout(20);
  }
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await cdp.detach();

  await expect
    .poll(() => scroller.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
});
