import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";

type Appearance = Record<string, unknown>;

const BASELINE: Appearance = {
  theme: "default",
  color: "#7c3aed",
  background: "gradient",
  card: "rounded",
  button: "solid",
  layout: "grouped",
  font: "sans",
  showAvatar: true,
  showBio: true,
  showSocial: true,
  showDescription: false,
};

let originalAppearance: Appearance | null = null;

async function readAppearance(page: Page): Promise<Appearance> {
  return page.evaluate(async () => {
    const response = await fetch("/api/v1/profile", {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Could not read appearance: ${response.status}`);
    }
    const payload = (await response.json()) as {
      data: { appearance: Appearance };
    };
    return payload.data.appearance;
  });
}

async function writeAppearance(
  page: Page,
  appearance: Appearance,
): Promise<void> {
  await page.evaluate(async (value) => {
    const csrfResponse = await fetch("/api/v1/auth/csrf", {
      credentials: "same-origin",
      cache: "no-store",
    });
    const csrfPayload = (await csrfResponse.json()) as {
      data: { csrfToken: string };
    };
    const response = await fetch("/api/v1/profile", {
      method: "PATCH",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfPayload.data.csrfToken,
      },
      body: JSON.stringify({ appearance: value }),
    });
    if (!response.ok) {
      throw new Error(
        `Could not write appearance: ${response.status} ${await response.text()}`,
      );
    }
  }, appearance);
}

function colorRow(page: Page, key: string) {
  return page.locator(`[data-color-row="${key}"]`);
}

function hexInput(page: Page, key: string) {
  return colorRow(page, key).locator("[data-color-input]");
}

function autoSwitch(page: Page, key: string) {
  return colorRow(page, key).getByRole("switch");
}

function preset(page: Page, id: string) {
  return page.locator(`[data-preset="${id}"]`);
}

async function openAppearance(page: Page): Promise<void> {
  await page.goto("/dashboard/appearance");
  await expect(
    page.getByRole("heading", { name: "Appearance", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Colors", exact: true }),
  ).toBeVisible();
}

async function pickPreset(page: Page, id: string): Promise<void> {
  await preset(page, id).click();
}

async function saveAndWait(
  page: Page,
  location: "header" | "savebar",
): Promise<void> {
  const response = page.waitForResponse(
    (candidate) =>
      candidate.url().includes("/api/v1/profile") &&
      candidate.request().method() === "PATCH",
  );
  await page
    .getByTestId(
      location === "header" ? "appearance-save" : "appearance-savebar-save",
    )
    .click();
  const result = await response;
  expect(result.ok()).toBe(true);
}

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext({ baseURL: "http://localhost:3100" });
  const page = await context.newPage();
  try {
    await login(page);
    originalAppearance = await readAppearance(page);
  } finally {
    await context.close();
  }
});

test.afterAll(async ({ browser }) => {
  if (!originalAppearance) return;
  const context = await browser.newContext({ baseURL: "http://localhost:3100" });
  const page = await context.newPage();
  try {
    await login(page);
    await writeAppearance(page, originalAppearance);
  } finally {
    await context.close();
  }
});

test.beforeEach(async ({ page }) => {
  await login(page);
  // Each case starts from the same palette so state never leaks between tests.
  await writeAppearance(page, BASELINE);
});

test("Auto resolves to pure black or white and never warns", async ({
  page,
}) => {
  await openAppearance(page);
  await pickPreset(page, "ocean");
  await expect(page.getByTestId("theme-exact")).toHaveText("Ocean selected");

  const rows = ["buttonText", "pageText", "title"] as const;
  for (const key of rows) {
    const row = colorRow(page, key);
    await expect(row.getByText("Custom", { exact: true })).toHaveCount(0);
    await expect(autoSwitch(page, key)).toHaveAttribute(
      "aria-checked",
      "false",
    );

    await autoSwitch(page, key).click();

    await expect(autoSwitch(page, key)).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(hexInput(page, key)).toHaveValue(
      /^Auto · #(?:000000|FFFFFF)$/,
    );
    // Auto is the system's best choice, so it must never be flagged.
    await expect(row.getByText(/Low contrast/)).toHaveCount(0);
    // Auto replaces Custom rather than stacking with it.
    await expect(row.getByText("Custom", { exact: true })).toHaveCount(0);
    // Auto rows keep a reset action.
    await expect(
      row.getByRole("button", { name: /Reset .* to Ocean/ }),
    ).toBeVisible();
  }

  // The Ocean button fill is dark enough that Auto must pick pure black.
  await expect(hexInput(page, "buttonText")).toHaveValue("Auto · #000000");
  await expect(page.locator("[data-auto-all]")).toBeDisabled();
});

test("Auto fields stay editable and typing exits Auto", async ({ page }) => {
  await openAppearance(page);
  await pickPreset(page, "ocean");
  await autoSwitch(page, "pageText").click();

  const field = hexInput(page, "pageText");
  await expect(field).toHaveValue(/^Auto · #(?:000000|FFFFFF)$/);
  await expect(autoSwitch(page, "pageText")).toHaveAttribute(
    "aria-checked",
    "true",
  );

  await field.fill("FFFFFF");

  await expect(autoSwitch(page, "pageText")).toHaveAttribute(
    "aria-checked",
    "false",
  );
  await expect(field).toHaveValue("FFFFFF");
  await expect(
    colorRow(page, "pageText").getByText("Custom", { exact: true }),
  ).toBeVisible();
  await expect(
    colorRow(page, "pageText").getByText(/Low contrast/),
  ).toBeVisible();
});

test("invalid hex is preserved and Save focuses the first invalid field", async ({
  page,
}) => {
  await openAppearance(page);
  const row = colorRow(page, "pageText");
  const field = hexInput(page, "pageText");

  await field.fill("B0C4DE");
  await expect(row.getByText("Custom", { exact: true })).toBeVisible();
  await expect(row.getByText(/Low contrast \d+\.\d:1/)).toBeVisible();
  await expect(row.locator("[data-use-auto]")).toBeVisible();

  await field.fill("FFFF");
  await expect(field).toHaveValue("FFFF");
  await expect(row.getByText("Use a 3 or 6 digit hex value.")).toBeVisible();
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByTestId("appearance-status-header")).toHaveText(
    "Fix 1 color",
  );
  // Save stays available; it points at the malformed field instead.
  await expect(page.getByTestId("appearance-save")).toBeEnabled();
  await page.getByTestId("appearance-save").click();
  await expect(field).toBeFocused();

  await field.fill("#123456");
  await expect(row.getByText("Use a 3 or 6 digit hex value.")).toHaveCount(0);
  await expect(field).not.toHaveAttribute("aria-invalid", "true");
  await expect(row.getByText(/Low contrast/)).toHaveCount(0);

  await row
    .getByRole("button", { name: /Reset page text to Default/ })
    .click();
  await expect(row.getByText("Custom", { exact: true })).toHaveCount(0);
  await expect(field).toHaveValue("4C4C6A");
  await expect(page.getByTestId("appearance-status-header")).toHaveText(
    "All changes saved",
  );
});

test("custom colors gate preset changes with Keep, Replace and Undo", async ({
  page,
}) => {
  await openAppearance(page);
  await pickPreset(page, "ocean");
  await expect(page.getByTestId("theme-exact")).toHaveText("Ocean selected");
  await expect(page.getByTestId("appearance-undo")).toContainText(
    "Ocean applied.",
  );

  await hexInput(page, "buttons").fill("#123456");
  await expect(page.getByTestId("theme-custom")).toHaveText(
    "Custom (based on Ocean)",
  );

  await pickPreset(page, "dark");
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Replace your custom colors?" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Keep my colors" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("theme-custom")).toHaveText(
    "Custom (based on Ocean)",
  );
  await expect(hexInput(page, "buttons")).toHaveValue("123456");

  await pickPreset(page, "dark");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Replace colors" })
    .click();
  await expect(preset(page, "dark")).toHaveAttribute("aria-pressed", "true");
  await expect(hexInput(page, "buttons")).toHaveValue("A78BFA");
  await expect(page.getByTestId("theme-exact")).toHaveText("Dark selected");

  const undo = page.getByTestId("appearance-undo");
  await expect(undo).toContainText("Dark applied.");
  await undo.locator("[data-undo]").click();
  await expect(hexInput(page, "buttons")).toHaveValue("123456");
  await expect(page.getByTestId("theme-custom")).toHaveText(
    "Custom (based on Ocean)",
  );

  // Clicking the active preset with custom colors asks before resetting.
  await pickPreset(page, "ocean");
  await expect(
    page
      .getByRole("dialog")
      .getByRole("heading", { name: "Reset your custom colors?" }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Reset to Ocean" })
    .click();
  await expect(hexInput(page, "buttons")).toHaveValue("0284C7");
  await expect(page.getByTestId("theme-exact")).toHaveText("Ocean selected");
});

test("reset all appearance settings restores defaults and can be undone", async ({
  page,
}) => {
  await openAppearance(page);
  await pickPreset(page, "dark");
  await expect(page.getByTestId("theme-exact")).toHaveText("Dark selected");

  await page
    .getByRole("button", { name: "Reset all appearance settings" })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Reset all appearance settings?" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Reset appearance" }).click();

  await expect(page.getByTestId("theme-exact")).toHaveText("Default selected");
  await expect(preset(page, "default")).toHaveAttribute("aria-pressed", "true");
  const undo = page.getByTestId("appearance-undo");
  await expect(undo).toContainText("Default appearance applied.");
  await undo.locator("[data-undo]").click();
  await expect(page.getByTestId("theme-exact")).toHaveText("Dark selected");
});

test("style and content controls update the page and persist", async ({
  page,
}) => {
  await openAppearance(page);
  const buttonTextRow = colorRow(page, "buttonText");

  await hexInput(page, "buttonText").fill("7C3AED");
  await expect(
    buttonTextRow.getByText("Only used by Brand-style buttons"),
  ).toBeVisible();
  // The warning is suppressed while the solid button style is active.
  await expect(buttonTextRow.getByText(/Low contrast/)).toHaveCount(0);

  await page.locator('[data-style-key="button"]').click();
  await page.locator('[data-option="brand"]').click();
  await expect(page.locator('[data-style-key="button"]')).toContainText(
    "Brand",
  );
  await expect(buttonTextRow.getByText(/Low contrast 1\.0:1/)).toBeVisible();

  await page.locator('[data-style-key="background"]').click();
  await page.locator('[data-option="solid"]').click();
  await expect(page.locator('[data-style-key="background"]')).toContainText(
    "Solid",
  );

  const social = page.locator('[data-visible="showSocial"]');
  await expect(social).toHaveAttribute("aria-checked", "true");
  await social.click();
  await expect(social).toHaveAttribute("aria-checked", "false");

  await saveAndWait(page, "header");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Appearance", level: 1 }),
  ).toBeVisible();
  await expect(page.locator('[data-style-key="button"]')).toContainText(
    "Brand",
  );
  await expect(page.locator('[data-style-key="background"]')).toContainText(
    "Solid",
  );
  await expect(page.locator('[data-visible="showSocial"]')).toHaveAttribute(
    "aria-checked",
    "false",
  );
  await expect(hexInput(page, "buttonText")).toHaveValue("7C3AED");
});

test("desktop save bar follows scrolling and saves changes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await openAppearance(page);

  const saveBar = page.getByTestId("appearance-savebar");
  const field = hexInput(page, "buttons");
  await expect(saveBar).toHaveCount(0);

  await field.fill("123456");
  await expect(page.getByTestId("appearance-status-header")).toHaveText(
    "Unsaved changes",
  );
  // On desktop the bar stays out of the way until the page scrolls.
  await expect(saveBar).toBeHidden();

  await page.evaluate(() => window.scrollTo(0, 500));
  await expect(saveBar).toBeVisible();

  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(saveBar).toBeHidden();

  await page.getByTestId("appearance-discard").click();
  await expect(field).toHaveValue("7C3AED");
  await expect(saveBar).toHaveCount(0);

  await field.fill("123456");
  await page.evaluate(() => window.scrollTo(0, 500));
  await expect(saveBar).toBeVisible();
  await saveAndWait(page, "savebar");
  await expect(saveBar).toHaveCount(0);
  await expect(page.getByTestId("appearance-status-header")).toHaveText(
    "All changes saved",
  );

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Appearance", level: 1 }),
  ).toBeVisible();
  await expect(field).toHaveValue("123456");
});

test("mobile save bar opens the preview sheet and saves Auto all text", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAppearance(page);

  const saveBar = page.getByTestId("appearance-savebar");
  const mobilePreview = page.getByTestId("appearance-preview-mobile");
  await expect(saveBar).toHaveCount(0);
  await expect(mobilePreview).toBeVisible();
  await expect(page.getByTestId("appearance-save")).toBeHidden();

  await page.locator("[data-auto-all]").click();
  for (const key of ["buttonText", "pageText", "title"] as const) {
    await expect(autoSwitch(page, key)).toHaveAttribute("aria-checked", "true");
  }
  await expect(page.locator("[data-auto-all]")).toBeDisabled();
  await expect(saveBar).toBeVisible();

  await page.getByTestId("appearance-preview-savebar").click();
  const preview = page.getByRole("dialog");
  await expect(
    preview.getByRole("heading", { name: "Live preview" }),
  ).toBeVisible();
  await expect(preview.locator(".phone-scroll")).toBeVisible();

  const box = await preview.boundingBox();
  expect(box).not.toBeNull();
  // The phone preview is a full-width bottom sheet.
  expect(box!.x).toBeLessThanOrEqual(1);
  expect(box!.width).toBeGreaterThanOrEqual(360);
  expect(844 - (box!.y + box!.height)).toBeLessThanOrEqual(1);

  await preview.getByRole("button", { name: "Close preview" }).click();
  await expect(preview).toBeHidden();

  await saveAndWait(page, "savebar");
  await expect(saveBar).toHaveCount(0);
  await expect(page.getByTestId("appearance-status-mobile")).toHaveText(
    "All changes saved",
  );

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Appearance", level: 1 }),
  ).toBeVisible();
  for (const key of ["buttonText", "pageText", "title"] as const) {
    await expect(autoSwitch(page, key)).toHaveAttribute("aria-checked", "true");
  }
});
