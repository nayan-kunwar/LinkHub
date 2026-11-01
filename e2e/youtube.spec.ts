import { expect, test } from "@playwright/test";
import { readFixtures } from "./fixtures";
import { mockRemoteAssets } from "./helpers";

test("lazy-loads the YouTube thumbnail and only embeds after a click", async ({
  page,
}) => {
  await mockRemoteAssets(page);
  const { username } = readFixtures();
  await page.goto(`/${username}`);

  const playButton = page.getByRole("button", {
    name: "Play video: E2E YouTube card",
  });
  await expect(playButton).toBeVisible();

  const thumbnail = playButton.locator("img");
  await expect(thumbnail).toHaveAttribute(
    "src",
    "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
  );
  await expect(thumbnail).toHaveAttribute("loading", "lazy");
  await expect(thumbnail).toHaveAttribute("decoding", "async");
  await expect(thumbnail).toHaveAttribute("referrerpolicy", "no-referrer");

  await expect(page.locator("iframe")).toHaveCount(0);

  await playButton.click();
  await expect(page.locator("iframe")).toHaveAttribute(
    "src",
    /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/,
  );
});
