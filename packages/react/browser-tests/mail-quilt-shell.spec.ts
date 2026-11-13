import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { focusStartOfTextBlock, textBlock } from "./helpers.js";

const shell = (page: Page) => page.locator("mail-quilt-shell");

test("shows the email in value, with the heading", async ({ page }) => {
  await page.goto("/?shell");

  await expect(textBlock(page)).toHaveText("Hello");
  await expect(shell(page).getByRole("heading")).toHaveText("Campaign");
  await expect(
    shell(page).getByRole("button", { name: "Import JSON" })
  ).toBeVisible();
});

test("with saveKey, a reload reopens the saved email rather than value", async ({
  page,
}) => {
  await page.goto("/?shell&save");
  await focusStartOfTextBlock(page);
  await page.keyboard.type("Saved ");
  await expect(textBlock(page)).toHaveText("Saved Hello");

  await page.reload();
  // Only once React has set `value`, after the Shell has opened.
  await expect(page.getByTestId("ready")).toHaveText("yes");

  await expect(textBlock(page)).toHaveText("Saved Hello");
});

test("actions picks the Shell's buttons", async ({ page }) => {
  await page.goto("/?shell&only-html");
  await expect(textBlock(page)).toHaveText("Hello");

  await expect(shell(page)).toHaveAttribute("actions", "export-html");
  await expect(
    shell(page).locator('[part="actions"]').getByRole("button")
  ).toHaveText(["Export HTML"]);
});
