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

async function openAppearance(page: Page): Promise<void> {
  await page.goto("/dashboard/appearance");
  await expect(
    page.getByRole("heading", { name: "Appearance", level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Palette" })).toBeVisible();
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
  await page.locator('[data-preset="ocean"]').click();

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
});

test("custom hex values warn, reject invalid input and reset to the preset", async ({
  page,
}) => {
  await openAppearance(page);
  const row = colorRow(page, "pageText");
  const field = hexInput(page, "pageText");

  await field.fill("B0C4DE");
  await expect(row.getByText("Custom", { exact: true })).toBeVisible();
  await expect(row.getByText(/Low contrast \d+\.\d:1/)).toBeVisible();

  await field.fill("FFFF");
  await expect(row.getByText("Use 3 or 6 hex characters")).toBeVisible();
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await expect(
    page.getByRole("button", { name: "Save", exact: true }).first(),
  ).toBeDisabled();

  await field.fill("#123456");
  await expect(row.getByText("Use 3 or 6 hex characters")).toHaveCount(0);
  await expect(field).not.toHaveAttribute("aria-invalid", "true");
  await expect(row.getByText(/Low contrast/)).toHaveCount(0);

  await row.getByRole("button", { name: /Reset page text to Default/ }).click();
  await expect(row.getByText("Custom", { exact: true })).toHaveCount(0);
  await expect(field).toHaveValue("4C4C6A");
});

test("custom colors gate preset changes with Keep, Replace and Undo", async ({
  page,
}) => {
  await openAppearance(page);
  await page.locator('[data-preset="ocean"]').click();
  await expect(page.locator('[data-preset="ocean"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await hexInput(page, "buttons").fill("#123456");
  await expect(page.getByTestId("theme-custom")).toHaveText(
    "Custom (based on Ocean)",
  );

  await page.locator('[data-preset="dark"]').click();
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

  await page.locator('[data-preset="dark"]').click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Replace colors" })
    .click();
  await expect(page.locator('[data-preset="dark"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(hexInput(page, "buttons")).toHaveValue("A78BFA");
  await expect(page.getByTestId("theme-custom")).toHaveCount(0);

  await page
    .locator("[data-sonner-toast]")
    .filter({ hasText: "Applied Dark." })
    .getByRole("button", { name: "Undo" })
    .click();
  await expect(hexInput(page, "buttons")).toHaveValue("123456");
  await expect(page.getByTestId("theme-custom")).toHaveText(
    "Custom (based on Ocean)",
  );

  // Clicking the active preset with custom colors asks before resetting.
  await page.locator('[data-preset="ocean"]').click();
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
  await expect(page.getByTestId("theme-custom")).toHaveCount(0);
});

test("desktop Cancel discards and Save persists the palette", async ({
  page,
}) => {
  await openAppearance(page);
  const field = hexInput(page, "buttons");

  await field.fill("123456");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(field).toHaveValue("7C3AED");
  await expect(page.getByTestId("appearance-savebar")).toBeHidden();

  await field.fill("123456");
  await page.getByRole("button", { name: "Save", exact: true }).first().click();
  await expect(
    page.getByText("Colors saved — your preview is up to date."),
  ).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Appearance", level: 1 }),
  ).toBeVisible();
  await expect(hexInput(page, "buttons")).toHaveValue("123456");
});

test("mobile preview FAB and toasts clear the save bar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAppearance(page);

  const saveBar = page.getByTestId("appearance-savebar");
  const fab = page.getByTestId("appearance-preview-fab");
  await expect(saveBar).toBeHidden();
  await expect(fab).toBeVisible();

  await hexInput(page, "pageText").fill("112233");
  await expect(saveBar).toBeVisible();

  const saveBox = await saveBar.boundingBox();
  const fabBox = await fab.boundingBox();
  expect(saveBox).not.toBeNull();
  expect(fabBox).not.toBeNull();
  expect(fabBox!.y + fabBox!.height).toBeLessThanOrEqual(saveBox!.y);

  // The Auto toast appears above both the save bar and the preview FAB.
  await autoSwitch(page, "pageText").click();
  const toast = page.locator("[data-sonner-toast].appearance-toast").last();
  await expect(toast).toContainText("Page text set to Auto");
  // Wait for the toast enter animation before measuring its resting position.
  await expect
    .poll(async () => {
      const box = await toast.boundingBox();
      return box ? box.y + box.height : Number.POSITIVE_INFINITY;
    })
    .toBeLessThanOrEqual(saveBox!.y);
  const toastBox = await toast.boundingBox();
  expect(toastBox).not.toBeNull();
  expect(toastBox!.y + toastBox!.height).toBeLessThanOrEqual(saveBox!.y);
  expect(toastBox!.y + toastBox!.height).toBeLessThanOrEqual(fabBox!.y);

  await fab.click();
  const preview = page.getByRole("dialog");
  await expect(
    preview.getByRole("heading", { name: "Live preview" }),
  ).toBeVisible();
  await expect(preview.locator(".phone-scroll")).toBeVisible();
  await preview.getByRole("button", { name: "Close" }).click();
  await expect(preview).toBeHidden();

  await saveBar.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByText("Colors saved — your preview is up to date."),
  ).toBeVisible();
  await expect(saveBar).toBeHidden();

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Appearance", level: 1 }),
  ).toBeVisible();
  await expect(autoSwitch(page, "pageText")).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(hexInput(page, "pageText")).toHaveValue(
    /^Auto · #(?:000000|FFFFFF)$/,
  );
});
